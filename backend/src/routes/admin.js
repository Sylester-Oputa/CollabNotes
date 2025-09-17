const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Analytics - Message statistics
router.get('/analytics/messages', authenticateToken, requireRole(['SUPER_ADMIN', 'HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { timeframe = '7d', companyId } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Base filters
    const companyFilter = req.user.role === 'SUPER_ADMIN' && companyId 
      ? { companyId } 
      : { companyId: req.user.companyId };

    // Message statistics
    const totalMessages = await prisma.message.count({
      where: {
        ...companyFilter,
        createdAt: { gte: startDate },
        deletedAt: null
      }
    });

    const directMessages = await prisma.message.count({
      where: {
        ...companyFilter,
        createdAt: { gte: startDate },
        deletedAt: null,
        groupId: null
      }
    });

    const groupMessages = await prisma.message.count({
      where: {
        ...companyFilter,
        createdAt: { gte: startDate },
        deletedAt: null,
        groupId: { not: null }
      }
    });

    // Message types breakdown
    const messageTypes = await prisma.message.groupBy({
      by: ['type'],
      where: {
        ...companyFilter,
        createdAt: { gte: startDate },
        deletedAt: null
      },
      _count: true
    });

    // Daily message counts for chart
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM messages 
      WHERE company_id = ${req.user.companyId}
        AND created_at >= ${startDate}
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Most active users
    const activeUsers = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        ...companyFilter,
        createdAt: { gte: startDate },
        deletedAt: null
      },
      _count: true,
      orderBy: {
        _count: {
          senderId: 'desc'
        }
      },
      take: 10
    });

    // Fetch user details for active users
    const userIds = activeUsers.map(u => u.senderId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true }
    });

    const activeUsersWithDetails = activeUsers.map(stat => ({
      ...stat,
      user: users.find(u => u.id === stat.senderId)
    }));

    res.json({
      timeframe,
      dateRange: { start: startDate, end: now },
      overview: {
        totalMessages,
        directMessages,
        groupMessages,
        messageTypes: messageTypes.reduce((acc, type) => {
          acc[type.type] = type._count;
          return acc;
        }, {})
      },
      dailyStats,
      activeUsers: activeUsersWithDetails
    });
  } catch (error) {
    console.error('Error fetching message analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// User activity monitoring
router.get('/users/activity', authenticateToken, requireRole(['SUPER_ADMIN', 'HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department } = req.query;
    const offset = (page - 1) * limit;

    const filters = {
      companyId: req.user.companyId
    };

    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (department) {
      filters.departmentId = department;
    }

    const users = await prisma.user.findMany({
      where: filters,
      include: {
        department: { select: { id: true, name: true } },
        _count: {
          select: {
            sentMessages: {
              where: {
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                deletedAt: null
              }
            }
          }
        }
      },
      orderBy: { lastSeen: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.user.count({ where: filters });

    res.json({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        lastSeen: user.lastSeen,
        isTyping: user.isTyping,
        messageCount30d: user._count.sentMessages,
        createdAt: user.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Content moderation - flagged/reported content
router.get('/moderation/messages', authenticateToken, requireRole(['SUPER_ADMIN', 'HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const offset = (page - 1) * limit;

    // For now, we'll show deleted messages as "moderated" content
    // In a real app, you'd have a separate reporting/flagging system
    const messages = await prisma.message.findMany({
      where: {
        companyId: req.user.companyId,
        deletedAt: status === 'deleted' ? { not: null } : null
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        recipient: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.message.count({
      where: {
        companyId: req.user.companyId,
        deletedAt: status === 'deleted' ? { not: null } : null
      }
    });

    res.json({
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        type: msg.type,
        sender: msg.sender,
        recipient: msg.recipient,
        group: msg.group,
        createdAt: msg.createdAt,
        deletedAt: msg.deletedAt,
        status: msg.deletedAt ? 'deleted' : 'active'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching moderation data:', error);
    res.status(500).json({ error: 'Failed to fetch moderation data' });
  }
});

// System health metrics
router.get('/system/health', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    // Database connection test
    const dbHealthCheck = await prisma.$queryRaw`SELECT 1 as test`;
    const dbStatus = dbHealthCheck ? 'healthy' : 'unhealthy';

    // Get system statistics
    const stats = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.messageGroup.count(),
      prisma.notification.count(),
      prisma.message.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          deletedAt: null
        }
      })
    ]);

    const [
      totalCompanies,
      totalUsers,
      totalMessages,
      totalGroups,
      totalNotifications,
      messagesLast24h
    ] = stats;

    // Storage usage (for file attachments)
    const attachments = await prisma.messageAttachment.aggregate({
      _sum: { fileSize: true },
      _count: true
    });

    // Recent error logs (you'd implement this based on your logging system)
    const recentErrors = []; // Placeholder for error log integration

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        connectionCount: 'N/A' // Would need database-specific queries
      },
      statistics: {
        companies: totalCompanies,
        users: totalUsers,
        messages: totalMessages,
        groups: totalGroups,
        notifications: totalNotifications,
        messagesLast24h
      },
      storage: {
        totalAttachments: attachments._count || 0,
        totalSize: attachments._sum.fileSize || 0,
        averageSize: attachments._count > 0 
          ? Math.round((attachments._sum.fileSize || 0) / attachments._count)
          : 0
      },
      errors: recentErrors
    });
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Failed to fetch system health',
      timestamp: new Date().toISOString()
    });
  }
});

// Company management (Super Admin only)
router.get('/companies', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const filters = {};
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const companies = await prisma.company.findMany({
      where: filters,
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.company.count({ where: filters });

    res.json({
      companies: companies.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        userCount: company._count.users,
        departmentCount: company._count.departments,
        messageCount: company._count.messages,
        createdAt: company.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Group management
router.get('/groups', authenticateToken, requireRole(['SUPER_ADMIN', 'HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const filters = { companyId: req.user.companyId };
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const groups = await prisma.messageGroup.findMany({
      where: filters,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            members: true,
            messages: { where: { deletedAt: null } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.messageGroup.count({ where: filters });

    res.json({
      groups: groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        creator: group.creator,
        memberCount: group._count.members,
        messageCount: group._count.messages,
        createdAt: group.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

module.exports = router;