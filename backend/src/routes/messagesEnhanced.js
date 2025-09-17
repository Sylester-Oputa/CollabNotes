const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const prisma = require('../utils/prisma');
const path = require('path');

const router = express.Router();

// Helper to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/messages/enhanced - send enhanced message with attachments
router.post(
  '/enhanced',
  authenticateToken,
  upload.array('attachments', 5),
  body('recipientId').optional().isString(),
  body('groupId').optional().isString(),
  body('content').trim().isLength({ min: 0, max: 2000 }),
  body('type').optional().isIn(['TEXT', 'FILE', 'IMAGE', 'VOICE']),
  body('parentId').optional().isString(),
  handleValidation,
  async (req, res) => {
    try {
      const { recipientId, groupId, content, type = 'TEXT', parentId } = req.body;
      const sender = req.user;
      const attachments = req.files || [];

      // Validate that either recipientId or groupId is provided
      if (!recipientId && !groupId) {
        return res.status(400).json({ error: 'Either recipientId or groupId must be provided' });
      }

      // For direct messages, ensure recipient is in same company
      if (recipientId) {
        const recipient = await prisma.user.findFirst({
          where: { id: recipientId, companyId: sender.companyId },
          select: { id: true }
        });
        if (!recipient) {
          return res.status(404).json({ error: 'Recipient not found' });
        }
      }

      // For group messages, ensure user is member of the group
      if (groupId) {
        const membership = await prisma.groupMembership.findFirst({
          where: { groupId, userId: sender.id },
          include: { group: true }
        });
        if (!membership || membership.group.companyId !== sender.companyId) {
          return res.status(403).json({ error: 'Not authorized to send to this group' });
        }
      }

      // Create message
      const messageData = {
        content: content || '',
        type,
        senderId: sender.id,
        companyId: sender.companyId,
        ...(recipientId && { recipientId }),
        ...(groupId && { groupId }),
        ...(parentId && { parentId })
      };

      const message = await prisma.message.create({
        data: messageData,
        include: {
          sender: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } }
        }
      });

      // Handle attachments
      if (attachments.length > 0) {
        const attachmentData = attachments.map(file => ({
          messageId: message.id,
          fileName: file.originalname,
          fileUrl: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype
        }));

        await prisma.messageAttachment.createMany({
          data: attachmentData
        });
      }

      // Get complete message with attachments
      const completeMessage = await prisma.message.findUnique({
        where: { id: message.id },
        include: {
          sender: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, name: true } }
            }
          }
        }
      });

      // Emit to recipients via Socket.IO
      try {
        const io = req.app.get('io');
        if (io) {
          if (recipientId) {
            // Direct message
            io.to(`user:${recipientId}`).emit('message:new', { message: completeMessage });
          } else if (groupId) {
            // Group message - emit to all group members
            const members = await prisma.groupMembership.findMany({
              where: { groupId },
              select: { userId: true }
            });
            
            members.forEach(member => {
              if (member.userId !== sender.id) {
                io.to(`user:${member.userId}`).emit('message:new', { message: completeMessage });
              }
            });
          }
        }
      } catch (emitErr) {
        console.error('Socket emit failed for enhanced message', emitErr);
      }

      return res.status(201).json(completeMessage);
    } catch (error) {
      console.error('Error sending enhanced message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// GET /api/messages/search - search messages
router.get(
  '/search',
  authenticateToken,
  query('q').notEmpty().withMessage('Search query is required'),
  query('type').optional().isIn(['direct', 'group', 'all']),
  query('userId').optional().isString(),
  query('groupId').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidation,
  async (req, res) => {
    try {
      const { q, type = 'all', userId, groupId, limit = 20, offset = 0 } = req.query;
      const me = req.user;

      const whereConditions = {
        companyId: me.companyId,
        content: {
          contains: q,
          mode: 'insensitive'
        },
        deletedAt: null
      };

      // Filter by message type
      if (type === 'direct') {
        whereConditions.groupId = null;
        if (userId) {
          whereConditions.OR = [
            { senderId: me.id, recipientId: userId },
            { senderId: userId, recipientId: me.id }
          ];
        } else {
          whereConditions.OR = [
            { senderId: me.id },
            { recipientId: me.id }
          ];
        }
      } else if (type === 'group') {
        whereConditions.groupId = { not: null };
        if (groupId) {
          whereConditions.groupId = groupId;
        }
      }

      const messages = await prisma.message.findMany({
        where: whereConditions,
        include: {
          sender: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const total = await prisma.message.count({
        where: whereConditions
      });

      return res.json({ messages, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (error) {
      console.error('Error searching messages:', error);
      return res.status(500).json({ error: 'Failed to search messages' });
    }
  }
);

// POST /api/messages/:id/react - add/remove reaction to message
router.post(
  '/:id/react',
  authenticateToken,
  param('id').notEmpty(),
  body('emoji').notEmpty().withMessage('Emoji is required'),
  handleValidation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const me = req.user;

      // Check if message exists and user has access
      const message = await prisma.message.findFirst({
        where: {
          id,
          companyId: me.companyId,
          OR: [
            { recipientId: me.id },
            { senderId: me.id },
            {
              group: {
                members: {
                  some: { userId: me.id }
                }
              }
            }
          ]
        }
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if reaction already exists
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId: id,
            userId: me.id,
            emoji
          }
        }
      });

      if (existingReaction) {
        // Remove reaction
        await prisma.messageReaction.delete({
          where: { id: existingReaction.id }
        });
      } else {
        // Add reaction
        await prisma.messageReaction.create({
          data: {
            messageId: id,
            userId: me.id,
            emoji
          }
        });
      }

      // Get updated reactions
      const reactions = await prisma.messageReaction.findMany({
        where: { messageId: id },
        include: {
          user: { select: { id: true, name: true } }
        }
      });

      // Emit reaction update
      try {
        const io = req.app.get('io');
        if (io) {
          if (message.recipientId) {
            io.to(`user:${message.recipientId}`).emit('message:reaction', { messageId: id, reactions });
            io.to(`user:${message.senderId}`).emit('message:reaction', { messageId: id, reactions });
          } else if (message.groupId) {
            const members = await prisma.groupMembership.findMany({
              where: { groupId: message.groupId },
              select: { userId: true }
            });
            
            members.forEach(member => {
              io.to(`user:${member.userId}`).emit('message:reaction', { messageId: id, reactions });
            });
          }
        }
      } catch (emitErr) {
        console.error('Socket emit failed for reaction', emitErr);
      }

      return res.json({ reactions });
    } catch (error) {
      console.error('Error handling reaction:', error);
      return res.status(500).json({ error: 'Failed to handle reaction' });
    }
  }
);

// PATCH /api/messages/:id/edit - edit message
router.patch(
  '/:id/edit',
  authenticateToken,
  param('id').notEmpty(),
  body('content').trim().isLength({ min: 1, max: 2000 }),
  handleValidation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const me = req.user;

      // Check if message exists and user is the sender
      const message = await prisma.message.findFirst({
        where: {
          id,
          senderId: me.id,
          companyId: me.companyId,
          deletedAt: null
        }
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found or not authorized' });
      }

      // Check if message is too old to edit (24 hours)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (message.createdAt < dayAgo) {
        return res.status(403).json({ error: 'Message too old to edit' });
      }

      const updatedMessage = await prisma.message.update({
        where: { id },
        data: {
          content,
          editedAt: new Date()
        },
        include: {
          sender: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          attachments: true,
          reactions: {
            include: {
              user: { select: { id: true, name: true } }
            }
          }
        }
      });

      // Emit edit update
      try {
        const io = req.app.get('io');
        if (io) {
          if (message.recipientId) {
            io.to(`user:${message.recipientId}`).emit('message:edited', { message: updatedMessage });
          } else if (message.groupId) {
            const members = await prisma.groupMembership.findMany({
              where: { groupId: message.groupId },
              select: { userId: true }
            });
            
            members.forEach(member => {
              io.to(`user:${member.userId}`).emit('message:edited', { message: updatedMessage });
            });
          }
        }
      } catch (emitErr) {
        console.error('Socket emit failed for edit', emitErr);
      }

      return res.json({ message: updatedMessage });
    } catch (error) {
      console.error('Error editing message:', error);
      return res.status(500).json({ error: 'Failed to edit message' });
    }
  }
);

// DELETE /api/messages/:id - delete message
router.delete(
  '/:id',
  authenticateToken,
  param('id').notEmpty(),
  handleValidation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const me = req.user;

      // Check if message exists and user is the sender or super admin
      const message = await prisma.message.findFirst({
        where: {
          id,
          companyId: me.companyId,
          deletedAt: null
        }
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (message.senderId !== me.id && me.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Not authorized to delete this message' });
      }

      // Soft delete
      await prisma.message.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'DELETED'
        }
      });

      // Emit deletion
      try {
        const io = req.app.get('io');
        if (io) {
          if (message.recipientId) {
            io.to(`user:${message.recipientId}`).emit('message:deleted', { messageId: id });
            io.to(`user:${message.senderId}`).emit('message:deleted', { messageId: id });
          } else if (message.groupId) {
            const members = await prisma.groupMembership.findMany({
              where: { groupId: message.groupId },
              select: { userId: true }
            });
            
            members.forEach(member => {
              io.to(`user:${member.userId}`).emit('message:deleted', { messageId: id });
            });
          }
        }
      } catch (emitErr) {
        console.error('Socket emit failed for deletion', emitErr);
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      return res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

module.exports = router;