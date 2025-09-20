const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Edit a message
router.put('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Message content too long (max 5000 characters)' });
    }

    // Find the message and verify ownership
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId // Only the sender can edit their own messages
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
      return res.status(404).json({ error: 'Message not found or you do not have permission to edit it' });
    }

    // Check if message is too old to edit (optional: 24 hour limit)
    const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    
    if (messageAge > editTimeLimit) {
      return res.status(400).json({ error: 'Message is too old to edit (24 hour limit)' });
    }

    // Store original content if this is the first edit
    const originalContent = message.editedAt ? message.content : (message.originalContent || message.content);

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        editedAt: new Date(),
        originalContent: message.editedAt ? message.originalContent : message.content
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      const socketData = {
        messageId,
        content: updatedMessage.content,
        editedAt: updatedMessage.editedAt,
        originalContent: updatedMessage.originalContent,
        isEdited: true
      };

      if (message.groupId) {
        // Emit to group members
        io.to(`group_${message.groupId}`).emit('message:edited', socketData);
      } else {
        // Emit to direct message participants
        io.to(`user_${message.senderId}`).emit('message:edited', socketData);
        if (message.recipientId) {
          io.to(`user_${message.recipientId}`).emit('message:edited', socketData);
        }
      }
    }

    res.json({
      success: true,
      message: updatedMessage
    });

  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Get edit history for a message
router.get('/:messageId/history', authenticateToken, async (req, res) => {
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

    // Return edit history
    const history = [];
    
    // Original version
    if (message.originalContent) {
      history.push({
        version: 1,
        content: message.originalContent,
        timestamp: message.createdAt,
        type: 'original'
      });
    }

    // Current version (if edited)
    if (message.editedAt) {
      history.push({
        version: 2,
        content: message.content,
        timestamp: message.editedAt,
        type: 'edited'
      });
    }

    // If no edits, just return current content
    if (history.length === 0) {
      history.push({
        version: 1,
        content: message.content,
        timestamp: message.createdAt,
        type: 'original'
      });
    }

    res.json({
      messageId,
      isEdited: !!message.editedAt,
      history
    });

  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// Delete a message (soft delete)
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Find the message and verify ownership
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId // Only the sender can delete their own messages
      },
      include: {
        group: true
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or you do not have permission to delete it' });
    }

    // Soft delete the message
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: '[Message deleted]',
        deletedAt: new Date(),
        type: 'DELETED'
      }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      const socketData = {
        messageId,
        deletedAt: deletedMessage.deletedAt,
        isDeleted: true
      };

      if (message.groupId) {
        // Emit to group members
        io.to(`group_${message.groupId}`).emit('message:deleted', socketData);
      } else {
        // Emit to direct message participants
        io.to(`user_${message.senderId}`).emit('message:deleted', socketData);
        if (message.recipientId) {
          io.to(`user_${message.recipientId}`).emit('message:deleted', socketData);
        }
      }
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;