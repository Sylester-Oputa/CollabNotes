const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../utils/prisma');

const router = express.Router();

// Helper to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/messages - send a message to a teammate
router.post(
  '/',
  authenticateToken,
  body('recipientId').notEmpty().withMessage('recipientId is required'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
  handleValidation,
  async (req, res) => {
    try {
      const { recipientId, content } = req.body;
      const sender = req.user;

      // Ensure recipient is in same company
      const recipient = await prisma.user.findFirst({
        where: { id: recipientId, companyId: sender.companyId },
        select: { id: true }
      });
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      const message = await prisma.message.create({
        data: {
          content,
          senderId: sender.id,
          recipientId,
          companyId: sender.companyId,
        },
      });

      // Emit to recipient via Socket.IO room if available
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${recipientId}`).emit('message:new', { message });
        }
      } catch (emitErr) {
        console.error('Socket emit failed for message:new', emitErr);
      }

      return res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// GET /api/messages/thread/:userId - get conversation between current user and another user
router.get(
  '/thread/:userId',
  authenticateToken,
  param('userId').notEmpty().withMessage('userId is required'),
  handleValidation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const me = req.user;

      // Ensure the other user is in same company
      const other = await prisma.user.findFirst({ where: { id: userId, companyId: me.companyId }, select: { id: true } });
      if (!other) return res.status(404).json({ error: 'User not found' });

      const messages = await prisma.message.findMany({
        where: {
          companyId: me.companyId,
          OR: [
            { senderId: me.id, recipientId: userId },
            { senderId: userId, recipientId: me.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      // Mark messages delivered when recipient pulls the thread
      const undeliveredIds = messages
        .filter(m => m.recipientId === me.id && !m.readAt)
        .map(m => m.id);
      if (undeliveredIds.length) {
        await prisma.message.updateMany({
          where: { id: { in: undeliveredIds } },
          data: { /* deliveredAt could be added in schema later */ }
        });
      }
      return res.json({ messages });
    } catch (error) {
      console.error('Error fetching thread:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

// GET /api/messages/company - super admin: view all employees messages for the company
router.get('/company', authenticateToken, async (req, res) => {
  try {
    const me = req.user;
    if (me.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const messages = await prisma.message.findMany({
      where: { companyId: me.companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        recipient: { select: { id: true, name: true, email: true } },
      },
    });

    return res.json({ messages });
  } catch (error) {
    console.error('Error fetching company messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PATCH /api/messages/:id/read - mark a message as read (recipient only)
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user;
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg || msg.companyId !== me.companyId) return res.status(404).json({ error: 'Not found' });
    if (msg.recipientId !== me.id) return res.status(403).json({ error: 'Forbidden' });
    const updated = await prisma.message.update({ where: { id }, data: { readAt: new Date() } });
    return res.json({ message: updated });
  } catch (error) {
    console.error('Error marking read:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;
