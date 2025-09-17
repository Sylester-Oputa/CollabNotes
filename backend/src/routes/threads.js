const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get thread (message and all its replies)
router.get('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get the parent message first
    const parentMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        },
        recipient: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: { replies: true }
        }
      }
    });

    if (!parentMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Get replies with pagination
    const replies = await prisma.message.findMany({
      where: {
        parentId: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: { replies: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: parseInt(limit)
    });

    const totalReplies = await prisma.message.count({
      where: {
        parentId: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      }
    });

    res.json({
      parentMessage,
      replies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalReplies,
        totalPages: Math.ceil(totalReplies / limit),
        hasNext: page * limit < totalReplies,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// Create a reply to a message
router.post('/:messageId/replies', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, type = 'TEXT' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify parent message exists and user has access
    const parentMessage = await prisma.message.findFirst({
      where: {
        id: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      include: {
        group: {
          include: {
            members: {
              where: { userId: req.user.id }
            }
          }
        }
      }
    });

    if (!parentMessage) {
      return res.status(404).json({ error: 'Parent message not found' });
    }

    // Check access permissions
    const hasAccess = parentMessage.senderId === req.user.id ||
                     parentMessage.recipientId === req.user.id ||
                     (parentMessage.group && parentMessage.group.members.length > 0);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create the reply
    const reply = await prisma.message.create({
      data: {
        content: content.trim(),
        type,
        senderId: req.user.id,
        recipientId: parentMessage.recipientId,
        groupId: parentMessage.groupId,
        companyId: req.user.companyId,
        parentId: messageId
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        },
        recipient: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        parent: {
          select: { id: true, content: true, sender: { select: { name: true } } }
        }
      }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('socketio');
    if (io) {
      // Emit to thread participants
      const threadRoom = `thread:${messageId}`;
      io.to(threadRoom).emit('newReply', {
        reply,
        parentMessageId: messageId
      });

      // Also emit to the general chat room if it's a group message
      if (parentMessage.groupId) {
        io.to(`group:${parentMessage.groupId}`).emit('threadActivity', {
          type: 'new_reply',
          messageId: messageId,
          replyCount: await prisma.message.count({
            where: { parentId: messageId, deletedAt: null }
          })
        });
      } else {
        // For direct messages, emit to both users
        io.to(`user:${parentMessage.senderId}`).emit('threadActivity', {
          type: 'new_reply',
          messageId: messageId,
          replyCount: await prisma.message.count({
            where: { parentId: messageId, deletedAt: null }
          })
        });
        if (parentMessage.recipientId) {
          io.to(`user:${parentMessage.recipientId}`).emit('threadActivity', {
            type: 'new_reply',
            messageId: messageId,
            replyCount: await prisma.message.count({
              where: { parentId: messageId, deletedAt: null }
            })
          });
        }
      }
    }

    res.status(201).json(reply);
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// Get thread summary (reply count and recent replies)
router.get('/:messageId/summary', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const summary = await prisma.message.findFirst({
      where: {
        id: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: {
          select: { id: true, name: true }
        },
        _count: {
          select: { replies: { where: { deletedAt: null } } }
        }
      }
    });

    if (!summary) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Get latest replies for preview
    const latestReplies = await prisma.message.findMany({
      where: {
        parentId: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    res.json({
      ...summary,
      replyCount: summary._count.replies,
      latestReplies: latestReplies.reverse() // Reverse to show chronological order
    });
  } catch (error) {
    console.error('Error fetching thread summary:', error);
    res.status(500).json({ error: 'Failed to fetch thread summary' });
  }
});

// Join/leave thread room for real-time updates
router.post('/:messageId/join', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Verify message exists and user has access
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        companyId: req.user.companyId,
        deletedAt: null
      },
      include: {
        group: {
          include: {
            members: {
              where: { userId: req.user.id }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const hasAccess = message.senderId === req.user.id ||
                     message.recipientId === req.user.id ||
                     (message.group && message.group.members.length > 0);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, threadRoom: `thread:${messageId}` });
  } catch (error) {
    console.error('Error joining thread:', error);
    res.status(500).json({ error: 'Failed to join thread' });
  }
});

module.exports = router;