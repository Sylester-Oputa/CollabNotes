const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { 
  authenticateToken, 
  requireRole, 
  requireSameCompany 
} = require('../middleware/auth');

// Get activity logs for a company
router.get('/company/:companyId', 
  authenticateToken, 
  requireSameCompany,
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { page = 1, limit = 50, action, userId } = req.query;

      const skip = (page - 1) * limit;
      const take = parseInt(limit);

      const where = {
        companyId,
        ...(action && { action }),
        ...(userId && { userId })
      };

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        prisma.activityLog.count({ where })
      ]);

      res.json({
        activities,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      });

    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get activity summary/stats
router.get('/company/:companyId/summary', 
  authenticateToken, 
  requireSameCompany,
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const { days = 7 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get activity counts by action type
      const activityCounts = await prisma.activityLog.groupBy({
        by: ['action'],
        where: {
          companyId,
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          action: true
        }
      });

      // Get recent activities by user
      const userActivity = await prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          companyId,
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          userId: true
        }
      });

      // Get user details for the activity summary
      const userIds = userActivity.map(ua => ua.userId);
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      });

      const userActivityWithDetails = userActivity.map(ua => ({
        user: users.find(u => u.id === ua.userId),
        activityCount: ua._count.userId
      }));

      // Get daily activity for the past week
      const dailyActivity = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM activity_logs
        WHERE company_id = ${companyId}
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      res.json({
        summary: {
          totalActivities: activityCounts.reduce((sum, ac) => sum + ac._count.action, 0),
          activityByType: activityCounts.map(ac => ({
            action: ac.action,
            count: ac._count.action
          })),
          activeUsers: userActivityWithDetails.length,
          userActivity: userActivityWithDetails,
          dailyActivity
        },
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        }
      });

    } catch (error) {
      console.error('Get activity summary error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;