// Activity Logger Utility for CollabNotes Platform
// Tracks all platform admin actions with Nigerian timezone support

const { PrismaClient } = require('@prisma/client');
const { getCurrentTime } = require('./currency');

const prisma = new PrismaClient();

/**
 * Log platform admin activities with Nigeria timezone
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - The action being performed
 * @param {object} metadata - Additional data about the action
 * @param {string} companyId - Optional company ID if action is company-specific
 * @param {string} timezone - Timezone for logging (defaults to Africa/Lagos)
 */
const logActivity = async (userId, action, metadata = {}, companyId = null, timezone = 'Africa/Lagos') => {
  try {
    // Ensure metadata includes Nigeria timezone info
    const enhancedMetadata = {
      ...metadata,
      timezone,
      timestamp: getCurrentTime(timezone),
      userAgent: metadata.userAgent || 'Unknown',
      ipAddress: metadata.ipAddress || 'Unknown'
    };

    // Create activity log entry
    const activityLog = await prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata: enhancedMetadata,
        companyId,
        createdAt: new Date() // UTC time for database consistency
      }
    });

    // Log to console for development (with Nigerian time)
    console.log(`🔍 [${getCurrentTime(timezone)}] Activity logged: ${action} by user ${userId}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Metadata:', JSON.stringify(enhancedMetadata, null, 2));
    }

    return activityLog;
  } catch (error) {
    // Don't throw errors for logging - just log the failure
    console.error('❌ Failed to log activity:', error.message);
    console.error('Action:', action, 'User:', userId, 'Metadata:', metadata);
    
    // In production, you might want to send this to an error tracking service
    return null;
  }
};

/**
 * Get recent activities for a user or platform
 * @param {object} options - Query options
 * @returns {Array} Array of recent activities
 */
const getRecentActivities = async (options = {}) => {
  try {
    const {
      userId = null,
      companyId = null,
      action = null,
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null,
      timezone = 'Africa/Lagos'
    } = options;

    const where = {};
    
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;
    if (action) where.action = action;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Format activities with Nigerian timezone
    return activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      metadata: activity.metadata,
      user: activity.user,
      company: activity.company,
      createdAt: activity.createdAt,
      localTime: getCurrentTime(timezone),
      timezone
    }));
  } catch (error) {
    console.error('❌ Failed to get recent activities:', error.message);
    return [];
  }
};

/**
 * Get activity statistics for dashboard
 * @param {object} options - Query options
 * @returns {object} Activity statistics
 */
const getActivityStats = async (options = {}) => {
  try {
    const {
      userId = null,
      companyId = null,
      days = 30,
      timezone = 'Africa/Lagos'
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = {
      createdAt: { gte: startDate }
    };
    
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;

    // Get activity counts by action type
    const activityCounts = await prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: {
        action: true
      },
      orderBy: {
        _count: {
          action: 'desc'
        }
      }
    });

    // Get daily activity counts
    const dailyActivities = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM activity_logs 
      WHERE created_at >= ${startDate}
      ${userId ? `AND user_id = '${userId}'` : ''}
      ${companyId ? `AND company_id = '${companyId}'` : ''}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const totalActivities = await prisma.activityLog.count({ where });

    return {
      totalActivities,
      activityCounts: activityCounts.map(item => ({
        action: item.action,
        count: item._count.action
      })),
      dailyActivities: dailyActivities.map(item => ({
        date: item.date,
        count: Number(item.count)
      })),
      period: {
        days,
        startDate,
        endDate: new Date(),
        timezone
      },
      lastUpdated: getCurrentTime(timezone)
    };
  } catch (error) {
    console.error('❌ Failed to get activity stats:', error.message);
    return {
      totalActivities: 0,
      activityCounts: [],
      dailyActivities: [],
      error: error.message
    };
  }
};

/**
 * Clean up old activity logs (for maintenance)
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {number} Number of deleted records
 */
const cleanupOldLogs = async (daysToKeep = 365) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`🧹 Cleaned up ${result.count} old activity logs older than ${daysToKeep} days`);
    return result.count;
  } catch (error) {
    console.error('❌ Failed to cleanup old logs:', error.message);
    return 0;
  }
};

module.exports = {
  logActivity,
  getRecentActivities,
  getActivityStats,
  cleanupOldLogs
};