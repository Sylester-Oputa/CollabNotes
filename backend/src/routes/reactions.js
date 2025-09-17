const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Add or remove a reaction to a message
router.post('/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji || typeof emoji !== 'string' || emoji.length > 10) {
      return res.status(400).json({ error: 'Valid emoji is required' });
    }

    // Check if message exists and user has access to it
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        OR: [
          // Direct message - user is sender or recipient
          {
            OR: [
              { senderId: userId },
              { recipientId: userId }
            ]
          },
          // Group message - user is member of the group
          {
            group: {
              members: {
                some: { userId }
              }
            }
          }
        ]
      },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    // Check if reaction already exists
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji
        }
      }
    });

    let reaction;
    let action;

    if (existingReaction) {
      // Remove existing reaction
      await prisma.messageReaction.delete({
        where: { id: existingReaction.id }
      });
      action = 'removed';
    } else {
      // Add new reaction
      reaction = await prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
      action = 'added';
    }

    // Get updated reaction summary
    const reactionSummary = await prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      const socketData = {
        messageId,
        action,
        emoji,
        user: req.user,
        reactionSummary: reactionSummary.map(r => ({
          emoji: r.emoji,
          count: r._count.emoji
        }))
      };

      if (message.groupId) {
        // Emit to group members
        io.to(`group_${message.groupId}`).emit('reaction:updated', socketData);
      } else {
        // Emit to direct message participants
        io.to(`user_${message.senderId}`).emit('reaction:updated', socketData);
        if (message.recipientId) {
          io.to(`user_${message.recipientId}`).emit('reaction:updated', socketData);
        }
      }
    }

    res.json({
      success: true,
      action,
      reaction,
      reactionSummary: reactionSummary.map(r => ({
        emoji: r.emoji,
        count: r._count.emoji
      }))
    });

  } catch (error) {
    console.error('Error managing reaction:', error);
    res.status(500).json({ error: 'Failed to manage reaction' });
  }
});

// Get reactions for a message
router.get('/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Verify user has access to the message
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        OR: [
          { senderId: userId },
          { recipientId: userId },
          {
            group: {
              members: {
                some: { userId }
              }
            }
          }
        ]
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    // Get detailed reactions
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push({
        id: reaction.id,
        user: reaction.user,
        createdAt: reaction.createdAt
      });
      return acc;
    }, {});

    // Create summary
    const reactionSummary = Object.entries(groupedReactions).map(([emoji, users]) => ({
      emoji,
      count: users.length,
      users: users.map(u => u.user),
      hasReacted: users.some(u => u.user.id === userId)
    }));

    res.json({
      reactions: groupedReactions,
      summary: reactionSummary
    });

  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// Get users who reacted with specific emoji
router.get('/:messageId/reactions/:emoji/users', authenticateToken, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.id;

    // Verify access
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        OR: [
          { senderId: userId },
          { recipientId: userId },
          {
            group: {
              members: {
                some: { userId }
              }
            }
          }
        ]
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    const reactions = await prisma.messageReaction.findMany({
      where: {
        messageId,
        emoji
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      emoji,
      users: reactions.map(r => ({
        ...r.user,
        reactedAt: r.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching reaction users:', error);
    res.status(500).json({ error: 'Failed to fetch reaction users' });
  }
});

module.exports = router;