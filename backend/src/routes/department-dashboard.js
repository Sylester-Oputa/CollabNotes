const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Department Overview - For regular users
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const { id: userId, companyId, department } = req.user;
    
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
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // User's department information
    let departmentInfo = null;
    if (req.user.departmentId) {
      departmentInfo = await prisma.department.findFirst({
        where: { 
          companyId,
          id: req.user.departmentId // Use departmentId from user instead of name
        },
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
    }

    // User's personal statistics
    const userStats = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            sentMessages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            },
            notifications: {
              where: {
                createdAt: { gte: startDate }
              }
            },
            groupMemberships: true
          }
        }
      }
    });

    // Department colleagues
    const colleagues = await prisma.user.findMany({
      where: {
        companyId,
        departmentId: req.user.departmentId, // Use departmentId instead of department
        id: { not: userId },
        // Only fetch colleagues if user has a department
        ...(req.user.departmentId ? {} : { id: { in: [] } }) // Return empty array if no department
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastSeen: true
      },
      take: 10,
      orderBy: { lastSeen: 'desc' }
    });

    // User's recent messages
    const recentMessages = await prisma.message.findMany({
      where: {
        senderId: userId,
        deletedAt: null,
        createdAt: { gte: startDate }
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // User's groups
    const userGroups = await prisma.messageGroup.findMany({
      where: {
        members: {
          some: { id: userId }
        }
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // User's notifications
    const unreadNotifications = await prisma.notification.count({
      where: {
        userId,
        read: false
      }
    });

    // User's message activity over time
    const messageActivity = await prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM messages 
      WHERE "senderId" = ${userId}
        AND "createdAt" >= ${startDate}
        AND "deletedAt" IS NULL
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    res.json({
      timeframe,
      dateRange: { start: startDate, end: now },
      department: departmentInfo ? {
        id: departmentInfo.id,
        name: departmentInfo.name,
        description: departmentInfo.description,
        userCount: departmentInfo._count.users,
        noteCount: departmentInfo._count.notes,
        taskCount: departmentInfo._count.tasks
      } : null,
      userStats: {
        messagesSent: userStats._count.sentMessages,
        notificationsReceived: userStats._count.notifications,
        groupMemberships: userStats._count.groupMemberships,
        unreadNotifications
      },
      colleagues: colleagues.map(colleague => ({
        id: colleague.id,
        name: colleague.name,
        email: colleague.email,
        lastSeen: colleague.lastSeen
      })),
      recentMessages: recentMessages.map(message => ({
        id: message.id,
        content: message.content,
        type: message.type,
        group: message.group,
        createdAt: message.createdAt
      })),
      groups: userGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        memberCount: group._count.members,
        recentMessageCount: group._count.messages,
        updatedAt: group.updatedAt
      })),
      analytics: {
        messageActivity
      }
    });
  } catch (error) {
    console.error('Error fetching department overview:', error);
    res.status(500).json({ error: 'Failed to fetch department overview' });
  }
});

// User's Personal Statistics
router.get('/my-stats', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const { id: userId } = req.user;
    
    const startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Personal message statistics
    const messageStats = await prisma.message.aggregate({
      where: {
        senderId: userId,
        createdAt: { gte: startDate },
        deletedAt: null
      },
      _count: true
    });

    // Messages by type
    const messagesByType = await prisma.message.groupBy({
      by: ['type'],
      where: {
        senderId: userId,
        createdAt: { gte: startDate },
        deletedAt: null
      },
      _count: true
    });

    // Reaction statistics
    const reactionStats = await prisma.messageReaction.count({
      where: {
        message: {
          senderId: userId,
          createdAt: { gte: startDate },
          deletedAt: null
        }
      }
    });

    // Group participation
    const groupParticipation = await prisma.messageGroup.findMany({
      where: {
        members: {
          some: { id: userId }
        }
      },
      include: {
        _count: {
          select: {
            messages: {
              where: {
                senderId: userId,
                createdAt: { gte: startDate },
                deletedAt: null
              }
            }
          }
        }
      }
    });

    res.json({
      timeframe,
      messageStats: {
        total: messageStats._count,
        byType: messagesByType,
        reactionsReceived: reactionStats
      },
      groupParticipation: groupParticipation.map(group => ({
        id: group.id,
        name: group.name,
        messagesSent: group._count.messages
      }))
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Department Colleagues
router.get('/colleagues', authenticateToken, async (req, res) => {
  try {
    const { search, status } = req.query;
    const { id: userId, companyId, departmentId } = req.user;

    // If user has no department, return empty list
    if (!departmentId) {
      return res.json({
        colleagues: []
      });
    }

    const filters = {
      companyId,
      departmentId,
      id: { not: userId }
    };

    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status === 'active') {
      filters.lastSeen = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const colleagues = await prisma.user.findMany({
      where: filters,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastSeen: true,
        createdAt: true
      },
      orderBy: [
        { lastSeen: 'desc' }
      ]
    });

    res.json({
      colleagues: colleagues.map(colleague => ({
        id: colleague.id,
        name: colleague.name,
        email: colleague.email,
        role: colleague.role,
        lastSeen: colleague.lastSeen,
        joinedAt: colleague.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching colleagues:', error);
    res.status(500).json({ error: 'Failed to fetch colleagues' });
  }
});

// User's Groups and Activities
router.get('/my-groups', authenticateToken, async (req, res) => {
  try {
    const { id: userId } = req.user;

    const groups = await prisma.messageGroup.findMany({
      where: {
        members: {
          some: { id: userId }
        }
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: {
              where: { deletedAt: null }
            }
          }
        },
        messages: {
          where: {
            deletedAt: null
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      groups: groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        isPrivate: group.isPrivate,
        memberCount: group._count.members,
        messageCount: group._count.messages,
        lastMessage: group.messages[0] || null,
        updatedAt: group.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// User's Recent Activity
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const { id: userId } = req.user;

    // Recent messages
    const recentMessages = await prisma.message.findMany({
      where: {
        senderId: userId,
        deletedAt: null
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Recent reactions received
    const recentReactions = await prisma.messageReaction.findMany({
      where: {
        message: {
          senderId: userId,
          deletedAt: null
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
        message: {
          select: {
            id: true,
            content: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      recentMessages: recentMessages.map(message => ({
        id: message.id,
        content: message.content,
        type: message.type,
        group: message.group,
        createdAt: message.createdAt
      })),
      recentReactions: recentReactions.map(reaction => ({
        id: reaction.id,
        emoji: reaction.emoji,
        user: reaction.user,
        message: reaction.message,
        createdAt: reaction.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

module.exports = router;