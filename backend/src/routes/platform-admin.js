const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Business Metrics - Revenue and financial analytics for platform owner
router.get('/business-metrics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    let previousStartDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        previousStartDate.setDate(now.getDate() - 14);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        previousStartDate.setDate(now.getDate() - 60);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        previousStartDate.setDate(now.getDate() - 180);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        previousStartDate.setFullYear(now.getFullYear() - 2);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
        previousStartDate.setDate(now.getDate() - 60);
    }

    // Get all companies (assuming all are paying for now)
    const totalCompanies = await prisma.company.count();
    const payingCompanies = totalCompanies; // In real app, filter by subscription status
    
    // New paying companies in timeframe
    const newPayingCompanies = await prisma.company.count({
      where: { createdAt: { gte: startDate } }
    });

    // Mock revenue calculations - in real app, get from billing/subscription table
    const baseRevenue = totalCompanies * 599; // Average monthly revenue per company
    const totalRevenue = baseRevenue + (Math.random() * 10000); // Add some variance
    
    // Previous period revenue for growth calculation
    const previousCompanies = await prisma.company.count({
      where: { createdAt: { lt: startDate } }
    });
    const previousRevenue = previousCompanies * 599;
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    
    const avgRevenuePerCompany = totalRevenue / (payingCompanies || 1);
    const avgRevenueGrowth = revenueGrowth; // Simplified for now
    
    const mrr = totalRevenue * 0.83; // Assume 83% is recurring
    const mrrGrowth = revenueGrowth * 0.9; // Slightly lower growth for MRR

    res.json({
      totalRevenue: Math.round(totalRevenue),
      revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
      payingCompanies,
      newPayingCompanies,
      avgRevenuePerCompany: Math.round(avgRevenuePerCompany),
      avgRevenueGrowth: parseFloat(avgRevenueGrowth.toFixed(1)),
      mrr: Math.round(mrr),
      mrrGrowth: parseFloat(mrrGrowth.toFixed(1)),
      totalCompanies
    });
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    res.status(500).json({ error: 'Failed to fetch business metrics' });
  }
});

// Revenue Data - Charts and analytics data
router.get('/revenue-data', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Mock monthly revenue data - in real app, get from billing/subscription records
    const monthlyRevenue = [
      { month: 'Jan', revenue: 32000 },
      { month: 'Feb', revenue: 35200 },
      { month: 'Mar', revenue: 38500 },
      { month: 'Apr', revenue: 41200 },
      { month: 'May', revenue: 43800 },
      { month: 'Jun', revenue: 45780 }
    ];

    // Mock revenue by plan type - in real app, aggregate from subscription data
    const revenueByPlan = [
      { name: 'Starter', revenue: 8950 },
      { name: 'Professional', revenue: 18420 },
      { name: 'Enterprise', revenue: 12680 },
      { name: 'Premium', revenue: 5730 }
    ];

    res.json({
      monthlyRevenue,
      revenueByPlan
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Company Revenue Details - Individual company revenue analytics
router.get('/company-revenue/:companyId', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeframe = '30d' } = req.query;

    // Get company details
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: true,
        departments: true,
        messages: { where: { deletedAt: null } },
        messageGroups: true
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Calculate company stats
    const companyStats = {
      ...company,
      userCount: company.users.length,
      messageCount: company.messages.length,
      groupCount: company.messageGroups.length,
      departmentCount: company.departments.length
    };

    // Mock revenue data - in real app, get from billing records
    const mockRevenue = [299, 599, 999, 1499, 149][Math.floor(Math.random() * 5)];
    const mockPlanType = ['Starter', 'Professional', 'Enterprise', 'Premium', 'Basic'][Math.floor(Math.random() * 5)];

    res.json({
      company: companyStats,
      monthlyRevenue: mockRevenue,
      planType: mockPlanType
    });
  } catch (error) {
    console.error('Error fetching company revenue:', error);
    res.status(500).json({ error: 'Failed to fetch company revenue' });
  }
});

// Platform Overview - Only for SUPER_ADMIN (Platform Owner)
router.get('/overview', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
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
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Platform-wide statistics
    const totalCompanies = await prisma.company.count();
    const totalUsers = await prisma.user.count();
    const totalMessages = await prisma.message.count({ where: { deletedAt: null } });
    const totalGroups = await prisma.messageGroup.count();

    // New companies in timeframe
    const newCompanies = await prisma.company.count({
      where: { createdAt: { gte: startDate } }
    });

    // New users in timeframe
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: startDate } }
    });

    // Messages in timeframe
    const messagesInTimeframe = await prisma.message.count({
      where: {
        createdAt: { gte: startDate },
        deletedAt: null
      }
    });

    // Active companies (companies with messages in the last 7 days)
    const activeCompanies = await prisma.company.count({
      where: {
        messages: {
          some: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            deletedAt: null
          }
        }
      }
    });

    // Company growth over time
    const companyGrowth = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM companies 
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // User growth over time
    const userGrowth = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users 
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Message activity over time
    const messageActivity = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM messages 
      WHERE created_at >= ${startDate}
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Top companies by activity
    const topCompaniesByActivity = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            messages: {
              where: {
                createdAt: { gte: startDate },
                deletedAt: null
              }
            },
            messageGroups: true
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

    // Storage usage
    const storageStats = await prisma.messageAttachment.aggregate({
      _sum: { fileSize: true },
      _count: true
    });

    res.json({
      timeframe,
      dateRange: { start: startDate, end: now },
      overview: {
        totalCompanies,
        totalUsers,
        totalMessages,
        totalGroups,
        newCompanies,
        newUsers,
        messagesInTimeframe,
        activeCompanies
      },
      growth: {
        companies: companyGrowth,
        users: userGrowth,
        messages: messageActivity
      },
      topCompanies: topCompaniesByActivity.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        userCount: company._count.users,
        messageCount: company._count.messages,
        groupCount: company._count.messageGroups,
        createdAt: company.createdAt
      })),
      storage: {
        totalAttachments: storageStats._count || 0,
        totalSize: storageStats._sum.fileSize || 0,
        averageSize: storageStats._count > 0 
          ? Math.round((storageStats._sum.fileSize || 0) / storageStats._count)
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching platform overview:', error);
    res.status(500).json({ error: 'Failed to fetch platform overview' });
  }
});

// Company Details - Only for SUPER_ADMIN
router.get('/companies/:companyId/details', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { timeframe = '30d' } = req.query;

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

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        departments: {
          include: {
            _count: {
              select: {
                users: true,
                notes: true,
                tasks: true
              }
            }
          }
        },
        _count: {
          select: {
            users: true,
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

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get recent activity
    const recentMessages = await prisma.message.count({
      where: {
        companyId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        deletedAt: null
      }
    });

    const activeUsers = await prisma.user.count({
      where: {
        companyId,
        lastSeen: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    res.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        createdAt: company.createdAt,
        userCount: company._count.users,
        messageCount: company._count.messages,
        groupCount: company._count.messageGroups,
        departmentCount: company.departments.length
      },
      departments: company.departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        userCount: dept._count.users,
        noteCount: dept._count.notes,
        taskCount: dept._count.tasks,
        createdAt: dept.createdAt
      })),
      activity: {
        recentMessages,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
});

// System Health - Only for SUPER_ADMIN
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

    // Storage usage
    const attachments = await prisma.messageAttachment.aggregate({
      _sum: { fileSize: true },
      _count: true
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        connectionCount: 'N/A'
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
      }
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

// Companies List with Pagination - Only for SUPER_ADMIN
router.get('/companies', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    const filters = {};
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const companies = await prisma.company.findMany({
      where: filters,
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } },
            messageGroups: true
          }
        }
      },
      orderBy,
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
        groupCount: company._count.messageGroups,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
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

module.exports = router;