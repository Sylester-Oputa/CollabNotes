const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
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

// GET /api/notifications/settings - get user notification settings
router.get(
  '/settings',
  authenticateToken,
  async (req, res) => {
    try {
      const me = req.user;

      const settings = await prisma.notificationSetting.findFirst({
        where: { userId: me.id }
      });

      // Return default settings if none exist
      if (!settings) {
        const defaultSettings = {
          emailNotifications: true,
          desktopNotifications: true,
          messageNotifications: true,
          groupNotifications: true,
          reactionNotifications: true,
          mentionNotifications: true
        };
        return res.json(defaultSettings);
      }

      return res.json(settings);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
  }
);

// PUT /api/notifications/settings - update user notification settings
router.put(
  '/settings',
  authenticateToken,
  body('emailNotifications').optional().isBoolean(),
  body('desktopNotifications').optional().isBoolean(),
  body('messageNotifications').optional().isBoolean(),
  body('groupNotifications').optional().isBoolean(),
  body('reactionNotifications').optional().isBoolean(),
  body('mentionNotifications').optional().isBoolean(),
  handleValidation,
  async (req, res) => {
    try {
      const me = req.user;
      const updates = req.body;

      const validFields = [
        'emailNotifications',
        'desktopNotifications', 
        'messageNotifications',
        'groupNotifications',
        'reactionNotifications',
        'mentionNotifications'
      ];

      const updateData = {};
      validFields.forEach(field => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const settings = await prisma.notificationSetting.upsert({
        where: { userId: me.id },
        create: {
          userId: me.id,
          ...updateData
        },
        update: updateData
      });

      return res.json(settings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return res.status(500).json({ error: 'Failed to update notification settings' });
    }
  }
);

// POST /api/notifications/test - send test notification
router.post(
  '/test',
  authenticateToken,
  body('type').isIn(['desktop', 'email']).withMessage('Type must be desktop or email'),
  handleValidation,
  async (req, res) => {
    try {
      const { type } = req.body;
      const me = req.user;

      if (type === 'desktop') {
        // Emit test desktop notification
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${me.id}`).emit('notification:desktop', {
            title: 'Test Notification',
            message: 'This is a test desktop notification from CollabNotes!',
            type: 'info',
            timestamp: new Date().toISOString()
          });
        }
      } else if (type === 'email') {
        // In a real app, you would send an actual email here
        // For now, we'll just simulate it
        console.log(`Test email notification sent to ${me.email}`);
      }

      return res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
      console.error('Error sending test notification:', error);
      return res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
);

// Utility function to send notifications (used by other parts of the app)
const sendNotification = async (io, userId, notification) => {
  try {
    // Check user's notification settings
    const settings = await prisma.notificationSetting.findFirst({
      where: { userId }
    });

    const shouldNotify = settings ? 
      (notification.type === 'message' && settings.messageNotifications) ||
      (notification.type === 'group' && settings.groupNotifications) ||
      (notification.type === 'reaction' && settings.reactionNotifications) ||
      (notification.type === 'mention' && settings.mentionNotifications) :
      true; // Default to true if no settings

    if (shouldNotify && io) {
      // Send desktop notification
      if (!settings || settings.desktopNotifications) {
        io.to(`user:${userId}`).emit('notification:desktop', notification);
      }

      // Store notification in database for persistence
      await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type || 'info'
        }
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Export the utility function for use in other routes
router.sendNotification = sendNotification;

module.exports = router;