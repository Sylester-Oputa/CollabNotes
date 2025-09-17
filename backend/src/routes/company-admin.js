const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Company Overview - For HEAD_OF_DEPARTMENT
router.get('/overview', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const { companyId } = req.user;
    
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
        startDate.setDate(now.getDate() - 30);
    }

    // Company statistics
    const companyStats = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            messages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            },
            messageGroups: true
          }
        }
      }
    });

    // Department statistics
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            users: true,
            notes: true,
            tasks: true
          }
        }
      }
    });

    // Active users in the last 24 hours
    const activeUsers = await prisma.user.count({
      where: {
        companyId,
        lastSeen: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    // Message activity over time for the company
    const messageActivity = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM messages 
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // User growth in the company
    const userGrowth = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users 
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Top active users in the company
    const topUsers = await prisma.user.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            sentMessages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            }
          }
        }
      },
      orderBy: {
        sentMessages: {
          _count: 'desc'
        }
      },
      take: 10
    });

    // Group activity
    const groupActivity = await prisma.messageGroup.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            messages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            },
            members: true
          }
        }
      },
      orderBy: {
        messages: {
          _count: 'desc'
        }
      },
      take: 10
    });

    res.json({
      timeframe,
      dateRange: { start: startDate, end: now },
      company: {
        id: companyStats.id,
        name: companyStats.name,
        userCount: companyStats._count.users,
        departmentCount: companyStats._count.departments,
        messageCount: companyStats._count.messages,
        groupCount: companyStats._count.messageGroups,
        activeUsers
      },
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        userCount: dept._count.users,
        noteCount: dept._count.notes,
        taskCount: dept._count.tasks,
        createdAt: dept.createdAt
      })),
      analytics: {
        messageActivity,
        userGrowth
      },
      topUsers: topUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        messageCount: user._count.sentMessages,
        lastSeen: user.lastSeen,
        avatar: user.avatar
      })),
      topGroups: groupActivity.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        messageCount: group._count.messages,
        memberCount: group._count.members,
        createdAt: group.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching company overview:', error);
    res.status(500).json({ error: 'Failed to fetch company overview' });
  }
});

// User Management - For HEAD_OF_DEPARTMENT
router.get('/users', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department, role, status } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * limit;

    const filters = { companyId };
    
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (department) {
      filters.department = department;
    }
    
    if (role) {
      filters.role = role;
    }
    
    if (status === 'active') {
      filters.lastSeen = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    } else if (status === 'inactive') {
      filters.lastSeen = { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const users = await prisma.user.findMany({
      where: filters,
      include: {
        _count: {
          select: {
            sentMessages: { where: { deletedAt: null } },
            receivedNotifications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
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
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        messageCount: user._count.sentMessages,
        notificationCount: user._count.receivedNotifications,
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
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Department Management - For HEAD_OF_DEPARTMENT
router.get('/departments', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { companyId } = req.user;

    const departments = await prisma.department.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            users: true,
            notes: true,
            tasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        description: dept.description,
        userCount: dept._count.users,
        noteCount: dept._count.notes,
        taskCount: dept._count.tasks,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Group Management - For HEAD_OF_DEPARTMENT
router.get('/groups', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * limit;

    const filters = { companyId };
    
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const groups = await prisma.messageGroup.findMany({
      where: filters,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
        isPrivate: group.isPrivate,
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

// Content Moderation - For HEAD_OF_DEPARTMENT
router.get('/content/flagged', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const { companyId } = req.user;
    const offset = (page - 1) * limit;

    const filters = {
      companyId,
      OR: [
        { content: { contains: 'flagged', mode: 'insensitive' } },
        { isReported: true }
      ]
    };

    if (type) {
      filters.type = type;
    }

    const messages = await prisma.message.findMany({
      where: filters,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.message.count({ where: filters });

    res.json({
      flaggedContent: messages.map(message => ({
        id: message.id,
        content: message.content,
        type: message.type,
        sender: message.sender,
        group: message.group,
        isReported: message.isReported,
        createdAt: message.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching flagged content:', error);
    res.status(500).json({ error: 'Failed to fetch flagged content' });
  }
});

// Company Settings - For HEAD_OF_DEPARTMENT
router.get('/settings', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { companyId } = req.user;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        settings: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// Update Company Settings - For HEAD_OF_DEPARTMENT
router.patch('/settings', authenticateToken, requireRole(['HEAD_OF_DEPARTMENT']), async (req, res) => {
  try {
    const { companyId } = req.user;
    const { name, email, settings } = req.body;

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(settings && { settings })
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        settings: true,
        updatedAt: true
      }
    });

    res.json({ company: updatedCompany });
  } catch (error) {
    console.error('Error updating company settings:', error);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

module.exports = router;