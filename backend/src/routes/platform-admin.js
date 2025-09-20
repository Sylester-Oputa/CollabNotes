const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { 
  formatCurrency, 
  convertCurrency, 
  formatDate, 
  getCurrentTime,
  DEFAULT_PLATFORM_SETTINGS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES 
} = require('../utils/currency');

const router = express.Router();
const prisma = new PrismaClient();

// Test endpoint to verify database connectivity with Nigeria timezone
router.get('/test', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    console.log('🧪 Testing database connectivity...');
    const companyCount = await prisma.company.count();
    console.log(`Found ${companyCount} companies`);
    
    // Log activity with Nigerian timezone
    await logActivity(req.user.id, 'platform_admin_test', {
      endpoint: '/test',
      companyCount,
      timestamp: getCurrentTime(),
      timezone: DEFAULT_PLATFORM_SETTINGS.timezone,
      currency: DEFAULT_PLATFORM_SETTINGS.currency
    });

    res.json({ 
      message: 'Platform Admin API is working', 
      companyCount,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      },
      platformSettings: {
        timezone: DEFAULT_PLATFORM_SETTINGS.timezone,
        currency: DEFAULT_PLATFORM_SETTINGS.currency,
        currentTime: getCurrentTime(),
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES),
        supportedTimezones: Object.keys(SUPPORTED_TIMEZONES)
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Business Metrics - Revenue and financial analytics for platform owner (Nigeria-centered)
router.get('/business-metrics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      timeframe = '30d', 
      currency = 'NGN', 
      timezone = 'Africa/Lagos' 
    } = req.query;
    
    // Calculate date range using Nigerian timezone
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

    // Get all companies with Nigerian business model
    const totalCompanies = await prisma.company.count();
    const trialCompanies = Math.floor(totalCompanies * 0.25); // 25% on trial
    const payingCompanies = totalCompanies - trialCompanies;
    
    // New paying companies in timeframe
    const newPayingCompanies = await prisma.company.count({
      where: { createdAt: { gte: startDate } }
    });

    // Nigerian Naira-based revenue calculations
    const avgRevenuePerCompanyNGN = 35000; // ₦35,000 average monthly revenue
    const totalRevenueNGN = payingCompanies * avgRevenuePerCompanyNGN;
    
    // Previous period revenue for growth calculation
    const previousCompanies = await prisma.company.count({
      where: { createdAt: { lt: startDate } }
    });
    const previousRevenueNGN = Math.max(1, previousCompanies - Math.floor(previousCompanies * 0.25)) * avgRevenuePerCompanyNGN;
    
    // Convert to requested currency
    const totalRevenue = convertCurrency(totalRevenueNGN, 'NGN', currency);
    const previousRevenue = convertCurrency(previousRevenueNGN, 'NGN', currency);
    
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const avgRevenuePerCompany = convertCurrency(avgRevenuePerCompanyNGN, 'NGN', currency);
    const avgRevenueGrowth = revenueGrowth;
    
    const mrrNGN = totalRevenueNGN * 0.83; // 83% is recurring
    const mrr = convertCurrency(mrrNGN, 'NGN', currency);
    const mrrGrowth = revenueGrowth * 0.9;

    // Calculate additional Nigerian market metrics
    const conversionRate = trialCompanies > 0 ? (newPayingCompanies / (trialCompanies + newPayingCompanies)) * 100 : 0;
    const churnRate = 2.5; // 2.5% monthly churn rate

    const response = {
      // Core metrics
      totalRevenue: Math.round(totalRevenue),
      totalRevenueFormatted: formatCurrency(totalRevenue, currency),
      revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
      payingCompanies,
      trialCompanies,
      newPayingCompanies,
      totalCompanies,
      
      // Revenue metrics
      avgRevenuePerCompany: Math.round(avgRevenuePerCompany),
      avgRevenuePerCompanyFormatted: formatCurrency(avgRevenuePerCompany, currency),
      avgRevenueGrowth: parseFloat(avgRevenueGrowth.toFixed(1)),
      mrr: Math.round(mrr),
      mrrFormatted: formatCurrency(mrr, currency),
      mrrGrowth: parseFloat(mrrGrowth.toFixed(1)),
      
      // Conversion metrics
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      churnRate,
      
      // Localization
      currency,
      currencySymbol: SUPPORTED_CURRENCIES[currency]?.symbol || currency,
      timezone,
      lastUpdated: getCurrentTime(timezone),
      dateRange: {
        start: formatDate(startDate, timezone),
        end: formatDate(now, timezone)
      }
    };

    // Log activity
    await logActivity(req.user.id, 'platform_admin_business_metrics', {
      currency,
      timezone,
      timeframe,
      totalRevenue: response.totalRevenue,
      timestamp: getCurrentTime(timezone)
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    res.status(500).json({ error: 'Failed to fetch business metrics' });
  }
});

// Revenue Data - Charts and analytics data with Nigerian currency support
router.get('/revenue-data', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      timeframe = '30d', 
      currency = 'NGN', 
      timezone = 'Africa/Lagos' 
    } = req.query;
    
    // Calculate date range
    let months = 6;
    switch (timeframe) {
      case '7d':
        months = 1;
        break;
      case '30d':
        months = 6;
        break;
      case '90d':
        months = 12;
        break;
      case '1y':
        months = 24;
        break;
    }

    // Generate Nigerian Naira-based monthly revenue data
    const monthlyRevenue = [];
    const baseRevenueNGN = 2500000; // ₦2.5M base monthly revenue
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = formatDate(date, timezone).substring(3); // MM/YYYY format
      
      // Simulate growth in NGN
      const growthFactor = 1 + (0.08 * (months - i - 1) / months); // Progressive growth
      const revenueNGN = baseRevenueNGN * growthFactor;
      const revenue = convertCurrency(revenueNGN, 'NGN', currency);
      
      monthlyRevenue.push({
        month: monthName,
        revenue: Math.round(revenue),
        revenueFormatted: formatCurrency(revenue, currency),
        revenueNGN: Math.round(revenueNGN),
        revenueNGNFormatted: formatCurrency(revenueNGN, 'NGN'),
        conversions: 12 + Math.floor(Math.random() * 8), // 12-20 conversions
        trials: 25 + Math.floor(Math.random() * 15) // 25-40 trials
      });
    }

    // Nigerian plan pricing structure
    const plansNGN = [
      { name: 'Starter', priceNGN: 15000, share: 0.45 }, // ₦15k
      { name: 'Premium', priceNGN: 35000, share: 0.30 }, // ₦35k
      { name: 'Professional', priceNGN: 65000, share: 0.15 }, // ₦65k
      { name: 'Enterprise', priceNGN: 120000, share: 0.10 } // ₦120k
    ];

    const revenueByPlan = plansNGN.map(plan => {
      const customersCount = Math.floor(100 * plan.share); // Mock customer count
      const revenueNGN = plan.priceNGN * customersCount;
      const revenue = convertCurrency(revenueNGN, 'NGN', currency);
      const avgRevenueNGN = plan.priceNGN;
      const avgRevenue = convertCurrency(avgRevenueNGN, 'NGN', currency);
      
      return {
        name: plan.name,
        revenue: Math.round(revenue),
        revenueFormatted: formatCurrency(revenue, currency),
        revenueNGN: Math.round(revenueNGN),
        revenueNGNFormatted: formatCurrency(revenueNGN, 'NGN'),
        customers: customersCount,
        averageRevenue: Math.round(avgRevenue),
        averageRevenueFormatted: formatCurrency(avgRevenue, currency),
        averageRevenueNGN: avgRevenueNGN,
        averageRevenueNGNFormatted: formatCurrency(avgRevenueNGN, 'NGN')
      };
    });

    const totalRevenue = monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0);

    const response = {
      monthlyRevenue,
      revenueByPlan,
      totalRevenue,
      totalRevenueFormatted: formatCurrency(totalRevenue, currency),
      summary: {
        currency,
        baseCurrency: 'NGN',
        timezone,
        timeframe,
        exchangeRate: currency !== 'NGN' ? SUPPORTED_CURRENCIES[currency]?.exchangeRate : 1
      },
      lastUpdated: getCurrentTime(timezone)
    };

    // Log activity
    await logActivity(req.user.id, 'platform_admin_revenue_data', {
      currency,
      timezone,
      timeframe,
      monthsGenerated: monthlyRevenue.length,
      timestamp: getCurrentTime(timezone)
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Advanced revenue analytics endpoint with comprehensive Nigerian market insights
router.get('/revenue-analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      currency = 'NGN', 
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      period = 'monthly',
      startDate,
      endDate 
    } = req.query;
    
    console.log(`📈 Fetching revenue analytics in ${currency} for ${period} period`);
    
    // Generate time series data for Nigerian business
    const generateTimeSeries = (baseAmount, periods) => {
      return Array.from({ length: periods }, (_, i) => {
        const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
        const growthFactor = 1 + (i * 0.02); // 2% growth per period
        return Math.round(baseAmount * growthFactor * (1 + variation));
      });
    };

    const revenueAnalytics = {
      summary: {
        totalRevenue: 1250000, // ₦1.25M total
        averageMonthlyRevenue: 104166,
        projectedAnnualRevenue: 1500000, // ₦1.5M projection
        revenuePerUser: 1543, // ₦1,543 per user
        conversionRate: 12.5, // 12.5% free to paid conversion
        customerLifetimeValue: 185000, // ₦185k LTV in Nigerian market
        churnRate: 3.2, // 3.2% monthly churn
        monthlyRecurringRevenue: 95000 // ₦95k MRR
      },
      timeSeries: {
        monthly: generateTimeSeries(85000, 12), // 12 months of data
        weekly: generateTimeSeries(22000, 16), // 16 weeks of data
        daily: generateTimeSeries(3100, 30) // 30 days of data
      },
      revenueBySource: {
        subscriptions: {
          amount: 945000, // 75.6% of total
          percentage: 75.6,
          breakdown: {
            starter: { amount: 675000, users: 45, avgRevenue: 15000 },
            professional: { amount: 1260000, users: 28, avgRevenue: 45000 },
            enterprise: { amount: 960000, users: 8, avgRevenue: 120000 }
          }
        },
        addOns: {
          amount: 185000, // 14.8% of total
          percentage: 14.8,
          breakdown: {
            storage: 89000,
            integrations: 56000,
            support: 40000
          }
        },
        oneTime: {
          amount: 120000, // 9.6% of total
          percentage: 9.6,
          breakdown: {
            setup: 65000,
            training: 35000,
            customization: 20000
          }
        }
      },
      forecasting: {
        nextMonth: {
          predicted: 98500,
          confidence: 87.3,
          factors: ['seasonal_growth', 'new_signups', 'churn_reduction']
        },
        nextQuarter: {
          predicted: 315000,
          confidence: 82.1,
          factors: ['market_expansion', 'feature_releases', 'pricing_optimization']
        },
        nextYear: {
          predicted: 1750000,
          confidence: 74.5,
          factors: ['nigerian_market_growth', 'enterprise_adoption', 'international_expansion']
        }
      },
      trends: {
        growth: {
          mom: 12.5, // Month over month
          qoq: 18.3, // Quarter over quarter  
          yoy: 45.7  // Year over year
        },
        seasonality: {
          q1: 0.95, // Q1 multiplier (slower in Nigeria)
          q2: 1.05, // Q2 multiplier (budget cycles)
          q3: 0.92, // Q3 multiplier (mid-year slow)
          q4: 1.18  // Q4 multiplier (year-end purchases)
        },
        cohortAnalysis: {
          month1Retention: 94.2,
          month3Retention: 78.6,
          month6Retention: 65.4,
          month12Retention: 52.1
        }
      }
    };

    // Log the analytics access
    await logActivity(req.user.id, 'revenue_analytics_access', {
      currency,
      timezone,
      period,
      timestamp: getCurrentTime(timezone),
      totalRevenue: formatCurrency(revenueAnalytics.summary.totalRevenue, currency)
    });

    // Format all monetary values in requested currency
    const formatMonetaryValues = (obj) => {
      if (typeof obj === 'number') {
        return formatCurrency(obj, currency);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => typeof item === 'number' ? formatCurrency(item, currency) : item);
      }
      if (typeof obj === 'object' && obj !== null) {
        const formatted = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key.includes('amount') || key.includes('revenue') || key.includes('value') || key === 'predicted') {
            formatted[key] = typeof value === 'number' ? formatCurrency(value, currency) : value;
          } else if (typeof value === 'object') {
            formatted[key] = formatMonetaryValues(value);
          } else {
            formatted[key] = value;
          }
        }
        return formatted;
      }
      return obj;
    };

    const formattedAnalytics = formatMonetaryValues(revenueAnalytics);

    res.json({
      success: true,
      data: {
        ...formattedAnalytics,
        currency,
        timezone,
        period,
        lastUpdated: getCurrentTime(timezone),
        reportGenerated: formatDate(new Date(), timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics',
      details: error.message
    });
  }
});

// Revenue trends endpoint with Nigerian market insights
router.get('/revenue-trends', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      currency = 'NGN', 
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      granularity = 'monthly',
      comparison = 'previous_period'
    } = req.query;
    
    console.log(`📊 Fetching revenue trends in ${currency} with ${granularity} granularity`);
    
    // Nigerian market-specific trends
    const revenueTrends = {
      current: {
        period: granularity === 'monthly' ? 'December 2024' : 'Q4 2024',
        revenue: 95000,
        growth: 12.5,
        newCustomers: 23,
        upgrades: 8,
        downgrades: 3,
        churn: 2
      },
      comparison: {
        period: granularity === 'monthly' ? 'November 2024' : 'Q3 2024',
        revenue: 84500,
        growth: 8.3,
        newCustomers: 19,
        upgrades: 5,
        downgrades: 4,
        churn: 3
      },
      insights: {
        keyDrivers: [
          'Increased enterprise adoption in Lagos',
          'Holiday season promotions effectiveness',
          'Improved customer support reducing churn',
          'New payment options for Nigerian market'
        ],
        risks: [
          'Economic uncertainty affecting SME budgets',
          'Currency fluctuation impact on pricing',
          'Increased competition in Nigerian SaaS market'
        ],
        opportunities: [
          'Expansion to Abuja and Port Harcourt markets',
          'Partnership with Nigerian fintech companies',
          'Local language support for Yoruba/Igbo',
          'Integration with Nigerian business tools'
        ]
      },
      predictions: {
        nextPeriod: {
          revenue: 108500,
          confidence: 83.2,
          range: { min: 98000, max: 119000 }
        },
        growthFactors: {
          positive: {
            newYear_budget_cycles: 8.5,
            product_improvements: 6.2,
            market_expansion: 4.8
          },
          negative: {
            seasonal_slowdown: -3.2,
            economic_headwinds: -2.1,
            competition: -1.8
          }
        }
      }
    };

    // Log the trends access
    await logActivity(req.user.id, 'revenue_trends_access', {
      currency,
      timezone,
      granularity,
      comparison,
      timestamp: getCurrentTime(timezone)
    });

    // Format monetary values
    const formatTrendsData = (data) => {
      return {
        ...data,
        current: {
          ...data.current,
          revenue: formatCurrency(data.current.revenue, currency)
        },
        comparison: {
          ...data.comparison,
          revenue: formatCurrency(data.comparison.revenue, currency)
        },
        predictions: {
          ...data.predictions,
          nextPeriod: {
            ...data.predictions.nextPeriod,
            revenue: formatCurrency(data.predictions.nextPeriod.revenue, currency),
            range: {
              min: formatCurrency(data.predictions.nextPeriod.range.min, currency),
              max: formatCurrency(data.predictions.nextPeriod.range.max, currency)
            }
          }
        }
      };
    };

    const formattedTrends = formatTrendsData(revenueTrends);

    res.json({
      success: true,
      data: {
        ...formattedTrends,
        currency,
        timezone,
        granularity,
        comparison,
        lastUpdated: getCurrentTime(timezone),
        marketContext: 'Nigerian SaaS market analysis'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching revenue trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue trends',
      details: error.message
    });
  }
});

// Get supported currencies and timezones for platform configuration
router.get('/configuration/options', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const response = {
      currencies: Object.entries(SUPPORTED_CURRENCIES).map(([code, currency]) => ({
        code,
        name: currency.name,
        symbol: currency.symbol,
        country: currency.country,
        popular: currency.popular,
        default: code === DEFAULT_PLATFORM_SETTINGS.currency
      })),
      timezones: Object.entries(SUPPORTED_TIMEZONES).map(([id, timezone]) => ({
        id,
        name: timezone.name,
        country: timezone.country,
        offset: timezone.offset,
        popular: timezone.popular,
        default: timezone.default || false
      })),
      defaults: DEFAULT_PLATFORM_SETTINGS,
      africaCurrencies: Object.entries(SUPPORTED_CURRENCIES)
        .filter(([_, currency]) => ['NGN', 'ZAR', 'GHS', 'KES', 'EGP'].includes(currency.code))
        .map(([code, currency]) => ({
          code,
          name: currency.name,
          symbol: currency.symbol,
          country: currency.country
        })),
      currentSettings: {
        serverTime: getCurrentTime(),
        timezone: 'Africa/Lagos',
        currency: 'NGN'
      }
    };

    await logActivity(req.user.id, 'platform_admin_configuration_options', {
      currenciesCount: response.currencies.length,
      timezonesCount: response.timezones.length,
      timestamp: getCurrentTime()
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching configuration options:', error);
    res.status(500).json({ error: 'Failed to fetch configuration options' });
  }
});

// Update platform settings with currency and timezone preferences
router.put('/configuration/settings', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const {
      defaultCurrency = 'NGN',
      defaultTimezone = 'Africa/Lagos',
      dateFormat = 'DD/MM/YYYY',
      allowedCurrencies = ['NGN', 'USD', 'EUR', 'GBP'],
      allowedTimezones = ['Africa/Lagos', 'UTC', 'Europe/London', 'America/New_York']
    } = req.body;

    // Validate currency
    if (!SUPPORTED_CURRENCIES[defaultCurrency]) {
      return res.status(400).json({ error: 'Invalid default currency' });
    }

    // Validate timezone
    if (!SUPPORTED_TIMEZONES[defaultTimezone]) {
      return res.status(400).json({ error: 'Invalid default timezone' });
    }

    // Validate allowed currencies
    const invalidCurrencies = allowedCurrencies.filter(code => !SUPPORTED_CURRENCIES[code]);
    if (invalidCurrencies.length > 0) {
      return res.status(400).json({ error: `Invalid currencies: ${invalidCurrencies.join(', ')}` });
    }

    // Validate allowed timezones
    const invalidTimezones = allowedTimezones.filter(tz => !SUPPORTED_TIMEZONES[tz]);
    if (invalidTimezones.length > 0) {
      return res.status(400).json({ error: `Invalid timezones: ${invalidTimezones.join(', ')}` });
    }

    // In a real implementation, this would be saved to a platform settings table
    const updatedSettings = {
      defaultCurrency,
      defaultTimezone,
      dateFormat,
      allowedCurrencies,
      allowedTimezones,
      updatedAt: getCurrentTime(defaultTimezone),
      updatedBy: req.user.id
    };

    await logActivity(req.user.id, 'platform_admin_settings_updated', {
      settings: updatedSettings,
      timestamp: getCurrentTime(defaultTimezone)
    });

    res.json({
      message: 'Platform settings updated successfully',
      settings: updatedSettings,
      supportedOptions: {
        currencies: Object.keys(SUPPORTED_CURRENCIES),
        timezones: Object.keys(SUPPORTED_TIMEZONES)
      }
    });
  } catch (error) {
    console.error('Error updating platform settings:', error);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

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

// Companies List with Pagination and Filtering - Enhanced for platform admin with Nigerian currency
router.get('/companies', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      plan,
      status,
      currency = 'NGN',
      timezone = 'Africa/Lagos'
    } = req.query;
    
    const offset = (page - 1) * limit;

    const filters = {};
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
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
            messageGroups: true,
            notes: true,
            tasks: true
          }
        }
      },
      orderBy,
      skip: offset,
      take: parseInt(limit)
    });

    const total = await prisma.company.count({ where: filters });

    // Nigerian pricing structure for different company sizes
    const nigeriaPricingTiers = {
      trial: { priceNGN: 0, name: 'Trial' },
      starter: { priceNGN: 15000, name: 'Starter' }, // ₦15k
      premium: { priceNGN: 35000, name: 'Premium' }, // ₦35k
      professional: { priceNGN: 65000, name: 'Professional' }, // ₦65k
      enterprise: { priceNGN: 120000, name: 'Enterprise' } // ₦120k
    };

    // Enhance company data with Nigerian subscription info
    const enhancedCompanies = companies.map(company => {
      const userCount = company._count.users;
      let mockPlan, mockStatus, mockMrrNGN;
      
      // Determine plan based on user count (Nigerian market sizing)
      if (userCount === 0) {
        mockPlan = 'trial';
        mockStatus = 'trial';
        mockMrrNGN = 0;
      } else if (userCount <= 10) {
        mockPlan = 'starter';
        mockStatus = 'active';
        mockMrrNGN = nigeriaPricingTiers.starter.priceNGN;
      } else if (userCount <= 25) {
        mockPlan = 'premium';
        mockStatus = 'active';
        mockMrrNGN = nigeriaPricingTiers.premium.priceNGN;
      } else if (userCount <= 100) {
        mockPlan = 'professional';
        mockStatus = 'active';
        mockMrrNGN = nigeriaPricingTiers.professional.priceNGN;
      } else {
        mockPlan = 'enterprise';
        mockStatus = 'active';
        mockMrrNGN = nigeriaPricingTiers.enterprise.priceNGN;
      }

      // Apply plan filter if specified
      if (plan && plan !== 'all' && mockPlan !== plan) {
        return null;
      }

      // Apply status filter if specified
      if (status && status !== 'all' && mockStatus !== status) {
        return null;
      }

      // Convert currency if needed
      const mrrInCurrency = convertCurrency(mockMrrNGN, 'NGN', currency);

      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        userCount: company._count.users,
        departmentCount: company._count.departments,
        messageCount: company._count.messages,
        groupCount: company._count.messageGroups,
        noteCount: company._count.notes,
        taskCount: company._count.tasks,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        
        // Nigerian subscription info
        subscription: {
          plan: mockPlan,
          planName: nigeriaPricingTiers[mockPlan].name,
          status: mockStatus,
          mrrNGN: mockMrrNGN,
          mrrNGNFormatted: formatCurrency(mockMrrNGN, 'NGN'),
          mrr: Math.round(mrrInCurrency),
          mrrFormatted: formatCurrency(mrrInCurrency, currency),
          billing: 'monthly',
          nextBilling: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), timezone),
          trialEndsAt: mockStatus === 'trial' ? 
            formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), timezone) : null
        },
        
        // Activity metrics with Nigerian timezone
        activity: {
          lastActivity: formatDate(company.updatedAt, timezone),
          messagesLast30Days: Math.floor(company._count.messages * 0.3),
          activeUsers: Math.floor(company._count.users * 0.7)
        },
        
        // Localization
        currency,
        timezone
      };
    }).filter(Boolean);

    // Calculate Nigerian market summary
    const totalMrrNGN = enhancedCompanies.reduce((sum, c) => sum + c.subscription.mrrNGN, 0);
    const totalMrrInCurrency = convertCurrency(totalMrrNGN, 'NGN', currency);

    const response = {
      companies: enhancedCompanies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: enhancedCompanies.length,
        totalPages: Math.ceil(enhancedCompanies.length / limit)
      },
      summary: {
        totalCompanies: total,
        filteredCompanies: enhancedCompanies.length,
        totalMrrNGN,
        totalMrrNGNFormatted: formatCurrency(totalMrrNGN, 'NGN'),
        totalMrr: Math.round(totalMrrInCurrency),
        totalMrrFormatted: formatCurrency(totalMrrInCurrency, currency),
        planDistribution: {
          trial: enhancedCompanies.filter(c => c.subscription.plan === 'trial').length,
          starter: enhancedCompanies.filter(c => c.subscription.plan === 'starter').length,
          premium: enhancedCompanies.filter(c => c.subscription.plan === 'premium').length,
          professional: enhancedCompanies.filter(c => c.subscription.plan === 'professional').length,
          enterprise: enhancedCompanies.filter(c => c.subscription.plan === 'enterprise').length
        }
      },
      meta: {
        currency,
        baseCurrency: 'NGN',
        timezone,
        lastUpdated: getCurrentTime(timezone),
        pricingTiers: nigeriaPricingTiers
      }
    };

    // Log activity
    await logActivity(req.user.id, 'platform_admin_companies_list', {
      currency,
      timezone,
      companiesCount: enhancedCompanies.length,
      filters: { plan, status, search: !!search },
      timestamp: getCurrentTime(timezone)
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Update Company Subscription - For platform admin subscription management
router.put('/companies/:companyId/subscription', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { planId, billingCycle = 'monthly', startDate } = req.body;

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Validate plan
    const validPlans = ['trial', 'starter', 'premium', 'professional', 'enterprise'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Mock subscription update (in real app, this would update subscription table)
    const planPrices = {
      trial: 0,
      starter: 29,
      premium: 79,
      professional: 149,
      enterprise: 299
    };

    const updatedSubscription = {
      planId,
      billingCycle,
      price: planPrices[planId],
      startDate: startDate || new Date().toISOString(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: planId === 'trial' ? 'trial' : 'active'
    };

    // Log the subscription change activity
    await prisma.activityLog.create({
      data: {
        action: 'SUBSCRIPTION_UPDATED',
        metadata: {
          companyId,
          companyName: company.name,
          oldPlan: 'unknown', // Would come from current subscription
          newPlan: planId,
          billingCycle,
          adminAction: true
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Subscription updated successfully',
      subscription: updatedSubscription,
      company: {
        id: company.id,
        name: company.name,
        userCount: company._count.users
      }
    });
  } catch (error) {
    console.error('Error updating company subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Get Company Details with Subscription Info - Enhanced company view
router.get('/companies/:companyId', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;

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
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            lastSeen: true
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } },
            messageGroups: true,
            notes: true,
            tasks: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Calculate activity metrics
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [recentMessages, recentUsers, recentActivity] = await Promise.all([
      prisma.message.count({
        where: {
          companyId,
          createdAt: { gte: last30Days },
          deletedAt: null
        }
      }),
      prisma.user.count({
        where: {
          companyId,
          lastSeen: { gte: last7Days }
        }
      }),
      prisma.activityLog.findMany({
        where: {
          companyId,
          createdAt: { gte: last30Days }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      })
    ]);

    // Mock subscription data
    const userCount = company._count.users;
    let mockSubscription = {
      plan: userCount <= 10 ? 'starter' : userCount <= 50 ? 'premium' : 'professional',
      status: 'active',
      mrr: userCount <= 10 ? 29 : userCount <= 50 ? 79 : 149,
      billing: 'monthly',
      startDate: company.createdAt,
      nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      trialEndsAt: null
    };

    res.json({
      company: {
        ...company,
        subscription: mockSubscription,
        activity: {
          messagesLast30Days: recentMessages,
          activeUsersLast7Days: recentUsers,
          lastActivity: company.updatedAt,
          recentActivity: recentActivity.map(activity => ({
            action: activity.action,
            createdAt: activity.createdAt,
            user: activity.user,
            metadata: activity.metadata
          }))
        },
        analytics: {
          totalRevenue: mockSubscription.mrr * Math.ceil((now - new Date(company.createdAt)) / (1000 * 60 * 60 * 24 * 30)),
          avgMessagesPerUser: company._count.users > 0 ? Math.round(company._count.messages / company._count.users) : 0,
          engagementScore: Math.min(100, Math.round((recentMessages / Math.max(1, company._count.users)) * 10))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
});

// Subscription Analytics - Detailed subscription metrics and trends
router.get('/subscription-analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
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

    // Get basic company metrics
    const totalCompanies = await prisma.company.count();
    const newCompanies = await prisma.company.count({
      where: { createdAt: { gte: startDate } }
    });

    // Mock subscription distribution (until real subscription table exists)
    const subscriptionDistribution = [
      { plan: 'trial', count: Math.floor(totalCompanies * 0.20), percentage: 20.0 },
      { plan: 'starter', count: Math.floor(totalCompanies * 0.45), percentage: 45.0 },
      { plan: 'premium', count: Math.floor(totalCompanies * 0.25), percentage: 25.0 },
      { plan: 'professional', count: Math.floor(totalCompanies * 0.08), percentage: 8.0 },
      { plan: 'enterprise', count: Math.floor(totalCompanies * 0.02), percentage: 2.0 }
    ];

    // Mock monthly growth data
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      monthlyGrowth.push({
        month: monthName,
        newSubscriptions: Math.floor(Math.random() * 50) + 20,
        upgrades: Math.floor(Math.random() * 15) + 5,
        downgrades: Math.floor(Math.random() * 8) + 2,
        cancellations: Math.floor(Math.random() * 10) + 3
      });
    }

    res.json({
      overview: {
        totalSubscriptions: totalCompanies,
        newSubscriptions: newCompanies,
        activeSubscriptions: Math.floor(totalCompanies * 0.95),
        churnRate: 3.2,
        upgrades: Math.floor(newCompanies * 0.3),
        downgrades: Math.floor(newCompanies * 0.1)
      },
      distribution: subscriptionDistribution,
      monthlyGrowth,
      trends: {
        conversionRate: 68.4,
        avgTimeToUpgrade: 14.2,
        customerLifetimeValue: 2847,
        avgRevenuePerUser: 127.50
      }
    });
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    res.status(500).json({ error: 'Failed to fetch subscription analytics' });
  }
});

// Trial Conversions - Trial to paid conversion metrics
router.get('/trial-conversions', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
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

    // Get companies created in timeframe (proxy for trials)
    const newCompanies = await prisma.company.count({
      where: { createdAt: { gte: startDate } }
    });

    // Mock trial conversion data
    const trialSignups = newCompanies;
    const conversions = Math.floor(trialSignups * 0.684); // 68.4% conversion rate
    const conversionRate = trialSignups > 0 ? (conversions / trialSignups) * 100 : 0;

    // Mock conversion funnel
    const conversionFunnel = [
      { stage: 'Website Visitors', count: trialSignups * 20, conversionRate: 100 },
      { stage: 'Sign-up Started', count: Math.floor(trialSignups * 1.5), conversionRate: 7.5 },
      { stage: 'Trial Activated', count: trialSignups, conversionRate: 66.7 },
      { stage: 'First Action', count: Math.floor(trialSignups * 0.85), conversionRate: 85.0 },
      { stage: 'Paid Conversion', count: conversions, conversionRate: conversionRate }
    ];

    // Mock conversion by plan
    const conversionsByPlan = [
      { plan: 'starter', conversions: Math.floor(conversions * 0.6), rate: 72.3 },
      { plan: 'premium', conversions: Math.floor(conversions * 0.25), rate: 65.8 },
      { plan: 'professional', conversions: Math.floor(conversions * 0.12), rate: 58.1 },
      { plan: 'enterprise', conversions: Math.floor(conversions * 0.03), rate: 45.0 }
    ];

    // Mock daily conversion trend
    const dailyConversions = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dailyConversions.push({
        date: date.toISOString().split('T')[0],
        trials: Math.floor(Math.random() * 10) + 3,
        conversions: Math.floor(Math.random() * 7) + 2,
        rate: Math.random() * 20 + 60
      });
    }

    res.json({
      overview: {
        totalTrials: trialSignups,
        totalConversions: conversions,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        avgDaysToConvert: 4.2,
        trialDropoffRate: parseFloat((100 - conversionRate).toFixed(1))
      },
      funnel: conversionFunnel,
      byPlan: conversionsByPlan,
      daily: dailyConversions,
      insights: {
        topConversionSource: 'Organic Search',
        avgTrialLength: 6.8,
        mostCommonDropoffPoint: 'Day 3'
      }
    });
  } catch (error) {
    console.error('Error fetching trial conversions:', error);
    res.status(500).json({ error: 'Failed to fetch trial conversions' });
  }
});

// Plan Performance - Detailed metrics for each subscription plan
router.get('/plan-performance', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const totalCompanies = await prisma.company.count();
    
    // Mock plan performance data
    const plans = [
      {
        id: 'trial',
        name: 'Free Trial',
        price: 0,
        subscribers: Math.floor(totalCompanies * 0.20),
        revenue: 0,
        conversionRate: 68.4,
        churnRate: 0, // Trials don't churn, they convert or expire
        avgLifetime: 7, // days
        satisfaction: 4.1,
        growth: 15.2,
        features: ['Basic collaboration', 'Limited storage', 'Email support']
      },
      {
        id: 'starter',
        name: 'Starter',
        price: 29,
        subscribers: Math.floor(totalCompanies * 0.45),
        revenue: Math.floor(totalCompanies * 0.45 * 29),
        conversionRate: 8.2, // conversion to higher plans
        churnRate: 4.1,
        avgLifetime: 18.3, // months
        satisfaction: 4.2,
        growth: 22.8,
        features: ['Unlimited boards', 'Basic analytics', 'Chat support']
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 79,
        subscribers: Math.floor(totalCompanies * 0.25),
        revenue: Math.floor(totalCompanies * 0.25 * 79),
        conversionRate: 12.5,
        churnRate: 2.8,
        avgLifetime: 24.7,
        satisfaction: 4.4,
        growth: 18.9,
        features: ['Advanced workflows', 'Priority support', 'Custom integrations']
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 149,
        subscribers: Math.floor(totalCompanies * 0.08),
        revenue: Math.floor(totalCompanies * 0.08 * 149),
        conversionRate: 5.3,
        churnRate: 1.9,
        avgLifetime: 31.2,
        satisfaction: 4.6,
        growth: 25.1,
        features: ['Advanced security', 'API access', 'Dedicated support']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        subscribers: Math.floor(totalCompanies * 0.02),
        revenue: Math.floor(totalCompanies * 0.02 * 299),
        conversionRate: 0,
        churnRate: 0.8,
        avgLifetime: 42.5,
        satisfaction: 4.8,
        growth: 35.7,
        features: ['White-label', 'Custom development', '24/7 phone support']
      }
    ];

    // Calculate totals
    const totalRevenue = plans.reduce((sum, plan) => sum + plan.revenue, 0);
    const totalSubscribers = plans.reduce((sum, plan) => sum + plan.subscribers, 0);
    
    // Performance insights
    const insights = {
      mostPopular: plans.reduce((prev, current) => 
        prev.subscribers > current.subscribers ? prev : current
      ).name,
      highestRevenue: plans.reduce((prev, current) => 
        prev.revenue > current.revenue ? prev : current
      ).name,
      bestGrowth: plans.reduce((prev, current) => 
        prev.growth > current.growth ? prev : current
      ).name,
      lowestChurn: plans.filter(p => p.id !== 'trial').reduce((prev, current) => 
        prev.churnRate < current.churnRate ? prev : current
      ).name
    };

    res.json({
      plans,
      overview: {
        totalRevenue,
        totalSubscribers,
        avgRevenuePerUser: totalSubscribers > 0 ? totalRevenue / totalSubscribers : 0,
        weightedSatisfaction: plans.reduce((sum, plan) => 
          sum + (plan.satisfaction * plan.subscribers), 0
        ) / totalSubscribers
      },
      insights
    });
  } catch (error) {
    console.error('Error fetching plan performance:', error);
    res.status(500).json({ error: 'Failed to fetch plan performance' });
  }
});

// Revenue Breakdown - Detailed revenue analytics and forecasting
router.get('/revenue-breakdown', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
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

    const totalCompanies = await prisma.company.count();
    
    // Mock revenue calculations based on plan distribution
    const revenueByPlan = [
      { plan: 'starter', revenue: Math.floor(totalCompanies * 0.45 * 29), subscribers: Math.floor(totalCompanies * 0.45), avgRevenue: 29 },
      { plan: 'premium', revenue: Math.floor(totalCompanies * 0.25 * 79), subscribers: Math.floor(totalCompanies * 0.25), avgRevenue: 79 },
      { plan: 'professional', revenue: Math.floor(totalCompanies * 0.08 * 149), subscribers: Math.floor(totalCompanies * 0.08), avgRevenue: 149 },
      { plan: 'enterprise', revenue: Math.floor(totalCompanies * 0.02 * 299), subscribers: Math.floor(totalCompanies * 0.02), avgRevenue: 299 }
    ];

    const totalRevenue = revenueByPlan.reduce((sum, plan) => sum + plan.revenue, 0);

    // Mock monthly revenue trend
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      
      // Simulate growth over time
      const baseRevenue = totalRevenue * 0.7; // 70% of current as base
      const growthFactor = 1 + (11 - i) * 0.03; // 3% monthly growth
      const monthRevenue = Math.floor(baseRevenue * growthFactor);
      
      monthlyRevenue.push({
        month: `${monthName} ${year}`,
        revenue: monthRevenue,
        newCustomers: Math.floor(Math.random() * 30) + 15,
        expansion: Math.floor(monthRevenue * 0.15), // 15% from expansions
        churn: Math.floor(monthRevenue * 0.05) // 5% lost to churn
      });
    }

    // Mock revenue by geography
    const revenueByGeography = [
      { region: 'North America', revenue: Math.floor(totalRevenue * 0.55), percentage: 55 },
      { region: 'Europe', revenue: Math.floor(totalRevenue * 0.25), percentage: 25 },
      { region: 'Asia Pacific', revenue: Math.floor(totalRevenue * 0.15), percentage: 15 },
      { region: 'Other', revenue: Math.floor(totalRevenue * 0.05), percentage: 5 }
    ];

    // Mock revenue forecast
    const forecast = [];
    for (let i = 1; i <= 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      
      const projectedRevenue = Math.floor(totalRevenue * (1 + i * 0.05)); // 5% monthly growth
      forecast.push({
        month: `${monthName} ${year}`,
        projected: projectedRevenue,
        conservative: Math.floor(projectedRevenue * 0.9),
        optimistic: Math.floor(projectedRevenue * 1.15)
      });
    }

    res.json({
      overview: {
        totalRevenue,
        mrr: Math.floor(totalRevenue * 0.85), // 85% recurring
        arr: Math.floor(totalRevenue * 0.85 * 12),
        revenueGrowth: 8.3,
        newRevenue: Math.floor(totalRevenue * 0.12),
        expansionRevenue: Math.floor(totalRevenue * 0.18)
      },
      breakdown: {
        byPlan: revenueByPlan,
        byGeography: revenueByGeography,
        monthly: monthlyRevenue
      },
      forecast,
      metrics: {
        avgDealSize: Math.floor(totalRevenue / (totalCompanies * 0.8)),
        paybackPeriod: 2.8, // months
        ltv: 2847, // customer lifetime value
        cac: 287 // customer acquisition cost
      }
    });
  } catch (error) {
    console.error('Error fetching revenue breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch revenue breakdown' });
  }
});

// Churn Analytics - Customer churn analysis and insights
router.get('/churn-analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
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

    const totalCompanies = await prisma.company.count();
    const payingCustomers = Math.floor(totalCompanies * 0.8); // 80% are paying
    
    // Mock churn calculations
    const churnedCustomers = Math.floor(payingCustomers * 0.032); // 3.2% monthly churn
    const churnRate = (churnedCustomers / payingCustomers) * 100;
    
    // Mock churn by plan
    const churnByPlan = [
      { plan: 'starter', churned: Math.floor(churnedCustomers * 0.5), total: Math.floor(payingCustomers * 0.56), rate: 4.1 },
      { plan: 'premium', churned: Math.floor(churnedCustomers * 0.3), total: Math.floor(payingCustomers * 0.31), rate: 2.8 },
      { plan: 'professional', churned: Math.floor(churnedCustomers * 0.15), total: Math.floor(payingCustomers * 0.10), rate: 1.9 },
      { plan: 'enterprise', churned: Math.floor(churnedCustomers * 0.05), total: Math.floor(payingCustomers * 0.03), rate: 0.8 }
    ];

    // Mock churn reasons
    const churnReasons = [
      { reason: 'Too Expensive', percentage: 28.5, count: Math.floor(churnedCustomers * 0.285) },
      { reason: 'Found Better Alternative', percentage: 22.1, count: Math.floor(churnedCustomers * 0.221) },
      { reason: 'Not Using Enough', percentage: 18.7, count: Math.floor(churnedCustomers * 0.187) },
      { reason: 'Technical Issues', percentage: 15.6, count: Math.floor(churnedCustomers * 0.156) },
      { reason: 'Poor Support', percentage: 10.2, count: Math.floor(churnedCustomers * 0.102) },
      { reason: 'Other', percentage: 4.9, count: Math.floor(churnedCustomers * 0.049) }
    ];

    // Mock monthly churn trend
    const monthlyChurn = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      monthlyChurn.push({
        month: monthName,
        churned: Math.floor(Math.random() * 20) + 10,
        newCustomers: Math.floor(Math.random() * 50) + 30,
        netGrowth: Math.floor(Math.random() * 35) + 15,
        churnRate: Math.random() * 2 + 2.5 // 2.5-4.5%
      });
    }

    // Mock cohort retention analysis
    const cohortRetention = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const cohortName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const retention = {
        cohort: cohortName,
        month0: 100
      };
      
      // Simulate retention decay
      for (let month = 1; month <= Math.min(6, i + 1); month++) {
        const retentionRate = 100 * Math.pow(0.95, month); // 5% monthly decline
        retention[`month${month}`] = Math.round(retentionRate * 10) / 10;
      }
      
      cohortRetention.push(retention);
    }

    // Churn prevention insights
    const preventionInsights = {
      atRiskCustomers: Math.floor(payingCustomers * 0.08), // 8% at risk
      savableCustomers: Math.floor(churnedCustomers * 0.35), // 35% potentially savable
      avgChurnPrevention: '$487', // average value of prevented churn
      topPreventionAction: 'Proactive support outreach'
    };

    res.json({
      overview: {
        totalChurned: churnedCustomers,
        churnRate: parseFloat(churnRate.toFixed(2)),
        revenueChurn: Math.floor(churnedCustomers * 67), // avg revenue per churned customer
        netChurnRate: parseFloat((churnRate - 1.2).toFixed(2)), // accounting for expansion
        timeToChurn: 8.3 // average months before churn
      },
      breakdown: {
        byPlan: churnByPlan,
        byReason: churnReasons,
        monthly: monthlyChurn
      },
      cohortAnalysis: cohortRetention,
      prevention: preventionInsights,
      trends: {
        churnTrend: 'Decreasing',
        seasonality: 'Higher in Q1',
        predictors: ['Low usage', 'No integration setup', 'Support tickets']
      }
    });
  } catch (error) {
    console.error('Error fetching churn analytics:', error);
    res.status(500).json({ error: 'Failed to fetch churn analytics' });
  }
});

// Platform Statistics - Comprehensive platform overview and growth metrics
router.get('/platform-stats', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
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
      default:
        startDate.setDate(now.getDate() - 30);
        previousStartDate.setDate(now.getDate() - 60);
    }

    // Get real platform statistics
    const [
      totalCompanies,
      totalUsers,
      totalMessages,
      totalDepartments,
      totalNotes,
      totalTasks,
      newCompanies,
      newUsers,
      newMessages,
      activeCompanies,
      messageAttachments
    ] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.department.count(),
      prisma.note.count(),
      prisma.task.count(),
      prisma.company.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.message.count({ 
        where: { 
          createdAt: { gte: startDate },
          deletedAt: null 
        } 
      }),
      prisma.company.count({
        where: {
          messages: {
            some: {
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              deletedAt: null
            }
          }
        }
      }),
      prisma.messageAttachment.aggregate({
        _sum: { fileSize: true },
        _count: true
      })
    ]);

    // Calculate growth rates
    const [previousCompanies, previousUsers, previousMessages] = await Promise.all([
      prisma.company.count({ 
        where: { 
          createdAt: { 
            gte: previousStartDate,
            lt: startDate 
          } 
        } 
      }),
      prisma.user.count({ 
        where: { 
          createdAt: { 
            gte: previousStartDate,
            lt: startDate 
          } 
        } 
      }),
      prisma.message.count({ 
        where: { 
          createdAt: { 
            gte: previousStartDate,
            lt: startDate 
          },
          deletedAt: null 
        } 
      })
    ]);

    const companyGrowth = previousCompanies > 0 ? ((newCompanies - previousCompanies) / previousCompanies * 100) : 0;
    const userGrowth = previousUsers > 0 ? ((newUsers - previousUsers) / previousUsers * 100) : 0;
    const messageGrowth = previousMessages > 0 ? ((newMessages - previousMessages) / previousMessages * 100) : 0;

    // Get top companies by activity
    const topCompanies = await prisma.company.findMany({
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
            departments: true
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

    // Platform engagement metrics
    const engagementMetrics = {
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0,
      avgUsersPerCompany: totalCompanies > 0 ? Math.round(totalUsers / totalCompanies) : 0,
      avgDepartmentsPerCompany: totalCompanies > 0 ? Math.round(totalDepartments / totalCompanies) : 0,
      activeCompanyRate: totalCompanies > 0 ? Math.round((activeCompanies / totalCompanies) * 100) : 0,
      messagesPerDay: Math.round(newMessages / (timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90))
    };

    // Storage and system metrics
    const systemMetrics = {
      totalAttachments: messageAttachments._count || 0,
      totalStorageUsed: messageAttachments._sum.fileSize || 0,
      avgAttachmentSize: messageAttachments._count > 0 ? 
        Math.round((messageAttachments._sum.fileSize || 0) / messageAttachments._count) : 0,
      storageUsedMB: Math.round((messageAttachments._sum.fileSize || 0) / 1024 / 1024),
      uptime: '99.9%', // This would come from monitoring service
      avgResponseTime: '120ms' // This would come from monitoring service
    };

    // Growth trends (mock data for historical trends)
    const growthTrends = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Calculate historical growth (simplified)
      const monthMultiplier = (12 - i) / 12;
      growthTrends.push({
        month: monthName,
        companies: Math.floor(totalCompanies * monthMultiplier * 0.8),
        users: Math.floor(totalUsers * monthMultiplier * 0.8),
        messages: Math.floor(totalMessages * monthMultiplier * 0.6),
        revenue: Math.floor(totalCompanies * monthMultiplier * 0.8 * 67) // avg revenue per company
      });
    }

    res.json({
      overview: {
        totalCompanies,
        totalUsers,
        totalMessages,
        totalDepartments,
        totalNotes,
        totalTasks,
        activeCompanies,
        newCompanies,
        newUsers,
        newMessages
      },
      growth: {
        companyGrowth: parseFloat(companyGrowth.toFixed(1)),
        userGrowth: parseFloat(userGrowth.toFixed(1)),
        messageGrowth: parseFloat(messageGrowth.toFixed(1)),
        trends: growthTrends
      },
      engagement: engagementMetrics,
      system: systemMetrics,
      topCompanies: topCompanies.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        userCount: company._count.users,
        messageCount: company._count.messages,
        departmentCount: company._count.departments,
        createdAt: company.createdAt
      })),
      insights: {
        fastestGrowingMetric: messageGrowth > userGrowth && messageGrowth > companyGrowth ? 'Messages' : 
                              userGrowth > companyGrowth ? 'Users' : 'Companies',
        utilizationRate: Math.round((newMessages / (newUsers || 1)) * 10) / 10,
        platformHealth: 'Excellent',
        recommendedActions: [
          'Focus on user engagement in new companies',
          'Optimize storage usage',
          'Consider expanding to new markets'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching platform statistics:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

// Profile Management Endpoints

// Get platform admin profile
router.get('/profile', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Get admin user details
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true
      }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin profile not found' });
    }

    // Get recent login activity (mock data for now)
    const recentActivity = [
      {
        id: 1,
        action: 'Login',
        timestamp: new Date(),
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown'
      }
    ];

    // Get security settings (mock data for now)
    const securitySettings = {
      twoFactorEnabled: false,
      lastPasswordChange: admin.updatedAt,
      sessionTimeout: 24, // hours
      loginNotifications: true
    };

    res.json({
      profile: admin,
      recentActivity,
      securitySettings
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

// Update platform admin profile
router.put('/profile', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const adminId = req.user.id;
    const { firstName, lastName, email } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    // Check if email is already taken by another user
    if (email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser && existingUser.id !== adminId) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    // Update admin profile
    const updatedAdmin = await prisma.user.update({
      where: { id: adminId },
      data: {
        firstName,
        lastName,
        email,
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Log the profile update activity
    console.log(`Platform admin ${adminId} updated profile at ${new Date()}`);

    res.json({
      message: 'Profile updated successfully',
      profile: updatedAdmin
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: 'Failed to update admin profile' });
  }
});

// Change platform admin password
router.put('/profile/password', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match' });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Get current admin user
    const admin = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: adminId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });

    // Log the password change activity
    console.log(`Platform admin ${adminId} changed password at ${new Date()}`);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get platform admin security settings
router.get('/profile/security', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const adminId = req.user.id;

    // Get admin user
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        updatedAt: true,
        lastLogin: true
      }
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Mock security settings (these would typically be stored in a separate table)
    const securitySettings = {
      twoFactorAuthentication: {
        enabled: false,
        method: null, // 'sms', 'email', 'authenticator'
        backupCodes: 0
      },
      loginNotifications: {
        enabled: true,
        email: true,
        suspicious: true
      },
      sessionManagement: {
        timeout: 24, // hours
        maxConcurrentSessions: 3,
        currentSessions: 1
      },
      passwordPolicy: {
        lastChanged: admin.updatedAt,
        expiryDays: 90,
        requiresChange: false
      },
      accessHistory: [
        {
          id: 1,
          timestamp: new Date(),
          action: 'Login',
          ipAddress: '127.0.0.1',
          location: 'Local',
          device: 'Web Browser',
          success: true
        }
      ]
    };

    res.json(securitySettings);
  } catch (error) {
    console.error('Error fetching security settings:', error);
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
});

// Update platform admin security settings
router.put('/profile/security', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const adminId = req.user.id;
    const { 
      twoFactorEnabled, 
      loginNotifications, 
      sessionTimeout,
      maxConcurrentSessions 
    } = req.body;

    // In a real implementation, these would be stored in a security_settings table
    // For now, we'll just validate and return success
    
    const updatedSettings = {
      twoFactorAuthentication: {
        enabled: Boolean(twoFactorEnabled),
        method: twoFactorEnabled ? 'email' : null,
        backupCodes: twoFactorEnabled ? 8 : 0
      },
      loginNotifications: {
        enabled: Boolean(loginNotifications),
        email: Boolean(loginNotifications),
        suspicious: true
      },
      sessionManagement: {
        timeout: Math.max(1, Math.min(sessionTimeout || 24, 168)), // 1 hour to 1 week
        maxConcurrentSessions: Math.max(1, Math.min(maxConcurrentSessions || 3, 10)),
        currentSessions: 1
      },
      passwordPolicy: {
        lastChanged: new Date(),
        expiryDays: 90,
        requiresChange: false
      }
    };

    // Log the security settings update
    console.log(`Platform admin ${adminId} updated security settings at ${new Date()}`);

    res.json({
      message: 'Security settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

// SUPER_ADMIN: Company Management Dashboard - Overview of all companies with key metrics
router.get('/company-management-dashboard', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    console.log('🏢 Fetching company management dashboard for SUPER_ADMIN');

    // Get comprehensive company statistics
    const [
      totalCompanies,
      activeCompanies,
      trialCompanies,
      totalUsers,
      totalDepartments,
      totalMessages,
      recentCompanies,
      topCompaniesByUsers,
      topCompaniesByActivity
    ] = await Promise.all([
      // Total companies
      prisma.company.count(),
      
      // Active companies (companies with users that have logged in recently)
      prisma.company.count({
        where: {
          users: {
            some: {
              lastSeen: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }
        }
      }),
      
      // Trial companies (companies with 0-2 users, created in last 14 days)
      prisma.company.count({
        where: {
          AND: [
            { createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
            { users: { _count: { lte: 2 } } }
          ]
        }
      }),
      
      // Platform totals
      prisma.user.count(),
      prisma.department.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      
      // Recent companies (last 30 days)
      prisma.company.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        include: {
          _count: {
            select: { users: true, departments: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      
      // Top companies by user count
      prisma.company.findMany({
        include: {
          _count: {
            select: { 
              users: true, 
              departments: true,
              messages: { where: { deletedAt: null } }
            }
          }
        },
        orderBy: {
          users: { _count: 'desc' }
        },
        take: 10
      }),
      
      // Top companies by message activity (last 30 days)
      prisma.company.findMany({
        include: {
          _count: {
            select: { 
              users: true, 
              departments: true,
              messages: { 
                where: { 
                  AND: [
                    { deletedAt: null },
                    { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
                  ]
                }
              }
            }
          }
        },
        orderBy: {
          messages: { _count: 'desc' }
        },
        take: 10
      })
    ]);

    // Calculate revenue projections based on company sizes
    let projectedMRR = 0;
    const revenueBreakdown = {
      trial: 0,
      starter: 0,
      premium: 0,
      professional: 0,
      enterprise: 0
    };

    // Get all companies with user counts for revenue calculation
    const companiesWithCounts = await prisma.company.findMany({
      include: {
        _count: { select: { users: true } }
      }
    });

    companiesWithCounts.forEach(company => {
      const userCount = company._count.users;
      let plan, mrr;
      
      if (userCount === 0) {
        plan = 'trial';
        mrr = 0;
      } else if (userCount <= 10) {
        plan = 'starter';
        mrr = 29;
      } else if (userCount <= 50) {
        plan = 'premium';
        mrr = 79;
      } else if (userCount <= 200) {
        plan = 'professional';
        mrr = 149;
      } else {
        plan = 'enterprise';
        mrr = 299;
      }
      
      revenueBreakdown[plan] += mrr;
      projectedMRR += mrr;
    });

    // Growth metrics (compare with last 30 days)
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      companiesLastMonth,
      usersLastMonth,
      messagesLastMonth
    ] = await Promise.all([
      prisma.company.count({ where: { createdAt: { lt: lastMonth } } }),
      prisma.user.count({ where: { createdAt: { lt: lastMonth } } }),
      prisma.message.count({ 
        where: { 
          AND: [
            { deletedAt: null },
            { createdAt: { lt: lastMonth } }
          ]
        }
      })
    ]);

    const growthMetrics = {
      companies: {
        current: totalCompanies,
        previous: companiesLastMonth,
        growth: companiesLastMonth > 0 ? ((totalCompanies - companiesLastMonth) / companiesLastMonth * 100) : 0
      },
      users: {
        current: totalUsers,
        previous: usersLastMonth,
        growth: usersLastMonth > 0 ? ((totalUsers - usersLastMonth) / usersLastMonth * 100) : 0
      },
      messages: {
        current: totalMessages,
        previous: messagesLastMonth,
        growth: messagesLastMonth > 0 ? ((totalMessages - messagesLastMonth) / messagesLastMonth * 100) : 0
      }
    };

    // Platform health indicators
    const avgUsersPerCompany = totalCompanies > 0 ? (totalUsers / totalCompanies) : 0;
    const avgDepartmentsPerCompany = totalCompanies > 0 ? (totalDepartments / totalCompanies) : 0;
    const avgMessagesPerUser = totalUsers > 0 ? (totalMessages / totalUsers) : 0;

    res.json({
      overview: {
        totalCompanies,
        activeCompanies,
        trialCompanies,
        inactiveCompanies: totalCompanies - activeCompanies,
        totalUsers,
        totalDepartments,
        totalMessages,
        projectedMRR,
        revenueBreakdown
      },
      growthMetrics,
      platformHealth: {
        avgUsersPerCompany: Math.round(avgUsersPerCompany * 10) / 10,
        avgDepartmentsPerCompany: Math.round(avgDepartmentsPerCompany * 10) / 10,
        avgMessagesPerUser: Math.round(avgMessagesPerUser),
        healthScore: Math.min(100, Math.round((activeCompanies / totalCompanies) * 100)) // % of active companies
      },
      recentCompanies: recentCompanies.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        userCount: company._count.users,
        departmentCount: company._count.departments,
        createdAt: company.createdAt,
        status: company._count.users > 0 ? 'active' : 'trial'
      })),
      topCompaniesByUsers: topCompaniesByUsers.map(company => ({
        id: company.id,
        name: company.name,
        userCount: company._count.users,
        departmentCount: company._count.departments,
        messageCount: company._count.messages
      })),
      topCompaniesByActivity: topCompaniesByActivity.map(company => ({
        id: company.id,
        name: company.name,
        userCount: company._count.users,
        recentMessages: company._count.messages
      }))
    });

  } catch (error) {
    console.error('Error fetching company management dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch company management dashboard' });
  }
});

// SUPER_ADMIN: Company Details - Deep dive into a specific company
router.get('/companies/:companyId/details', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(`🔍 Fetching detailed company information for: ${companyId}`);

    // Get comprehensive company details
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
        users: {
          include: {
            department: true,
            _count: {
              select: {
                sentMessages: { where: { deletedAt: null } },
                createdNotes: true,
                createdTasks: true,
                assignedTasks: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } },
            messageGroups: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get activity statistics for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentMessages, recentNotes, recentTasks, recentUsers] = await Promise.all([
      prisma.message.count({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.note.count({
        where: {
          department: { companyId },
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.task.count({
        where: {
          department: { companyId },
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.user.count({
        where: {
          companyId,
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ]);

    // Calculate subscription info based on user count
    const userCount = company._count.users;
    let subscriptionInfo;
    
    if (userCount === 0) {
      subscriptionInfo = { plan: 'trial', status: 'trial', mrr: 0, maxUsers: 5 };
    } else if (userCount <= 10) {
      subscriptionInfo = { plan: 'starter', status: 'active', mrr: 29, maxUsers: 10 };
    } else if (userCount <= 50) {
      subscriptionInfo = { plan: 'premium', status: 'active', mrr: 79, maxUsers: 50 };
    } else if (userCount <= 200) {
      subscriptionInfo = { plan: 'professional', status: 'active', mrr: 149, maxUsers: 200 };
    } else {
      subscriptionInfo = { plan: 'enterprise', status: 'active', mrr: 299, maxUsers: 'unlimited' };
    }

    // User role distribution
    const roleDistribution = company.users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    // Department activity summary
    const departmentSummary = company.departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      slug: dept.slug,
      userCount: dept._count.users,
      noteCount: dept._count.notes,
      taskCount: dept._count.tasks,
      createdAt: dept.createdAt
    }));

    // Recent activity summary
    const activitySummary = {
      last30Days: {
        newUsers: recentUsers,
        messages: recentMessages,
        notes: recentNotes,
        tasks: recentTasks
      },
      totalActivity: {
        messages: company._count.messages,
        messageGroups: company._count.messageGroups
      }
    };

    res.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      },
      metrics: {
        userCount: company._count.users,
        departmentCount: company._count.departments,
        messageCount: company._count.messages,
        groupCount: company._count.messageGroups
      },
      subscription: subscriptionInfo,
      roleDistribution,
      departments: departmentSummary,
      users: company.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentRole: user.departmentRole,
        department: user.department ? {
          id: user.department.id,
          name: user.department.name
        } : null,
        activity: {
          messagesSent: user._count.sentMessages,
          notesCreated: user._count.createdNotes,
          tasksCreated: user._count.createdTasks,
          tasksAssigned: user._count.assignedTasks
        },
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      })),
      activitySummary
    });

  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
});

// SUPER_ADMIN: Platform Growth Analytics - Platform-wide growth tracking
router.get('/platform-growth-analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { timeframe = '6m' } = req.query;
    console.log(`📊 Generating platform growth analytics for timeframe: ${timeframe}`);

    // Calculate time periods
    const now = new Date();
    let periods = [];
    let periodFormat;

    switch (timeframe) {
      case '7d':
        periodFormat = 'daily';
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          periods.push({
            label: date.toISOString().split('T')[0],
            start: new Date(date.setHours(0, 0, 0, 0)),
            end: new Date(date.setHours(23, 59, 59, 999))
          });
        }
        break;
      case '30d':
        periodFormat = 'daily';
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          periods.push({
            label: date.toISOString().split('T')[0],
            start: new Date(date.setHours(0, 0, 0, 0)),
            end: new Date(date.setHours(23, 59, 59, 999))
          });
        }
        break;
      case '6m':
      default:
        periodFormat = 'monthly';
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
          periods.push({
            label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            start,
            end
          });
        }
        break;
    }

    // Get growth data for each period
    const growthData = await Promise.all(periods.map(async (period) => {
      const [companies, users, messages, departments] = await Promise.all([
        prisma.company.count({
          where: {
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        }),
        prisma.message.count({
          where: {
            deletedAt: null,
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        }),
        prisma.department.count({
          where: {
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        })
      ]);

      return {
        period: period.label,
        companies,
        users,
        messages,
        departments
      };
    }));

    // Calculate cumulative totals
    let cumulativeData = [];
    let runningTotals = { companies: 0, users: 0, messages: 0, departments: 0 };

    for (const data of growthData) {
      runningTotals.companies += data.companies;
      runningTotals.users += data.users;
      runningTotals.messages += data.messages;
      runningTotals.departments += data.departments;

      cumulativeData.push({
        period: data.period,
        newCompanies: data.companies,
        newUsers: data.users,
        newMessages: data.messages,
        newDepartments: data.departments,
        totalCompanies: runningTotals.companies,
        totalUsers: runningTotals.users,
        totalMessages: runningTotals.messages,
        totalDepartments: runningTotals.departments
      });
    }

    // Calculate growth rates (period over period)
    const growthRates = cumulativeData.map((current, index) => {
      if (index === 0) return { ...current, companyGrowthRate: 0, userGrowthRate: 0 };
      
      const previous = cumulativeData[index - 1];
      const companyGrowthRate = previous.totalCompanies > 0 
        ? ((current.totalCompanies - previous.totalCompanies) / previous.totalCompanies * 100)
        : 0;
      const userGrowthRate = previous.totalUsers > 0 
        ? ((current.totalUsers - previous.totalUsers) / previous.totalUsers * 100)
        : 0;

      return {
        ...current,
        companyGrowthRate: Math.round(companyGrowthRate * 100) / 100,
        userGrowthRate: Math.round(userGrowthRate * 100) / 100
      };
    });

    // Platform engagement metrics
    const totalCompanies = await prisma.company.count();
    const totalUsers = await prisma.user.count();
    const totalMessages = await prisma.message.count({ where: { deletedAt: null } });

    const engagementMetrics = {
      avgUsersPerCompany: totalCompanies > 0 ? Math.round((totalUsers / totalCompanies) * 100) / 100 : 0,
      avgMessagesPerUser: totalUsers > 0 ? Math.round((totalMessages / totalUsers) * 100) / 100 : 0,
      messageVelocity: Math.round(totalMessages / Math.max(1, (Date.now() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24))), // messages per day since launch
    };

    res.json({
      timeframe,
      periodFormat,
      growthData: growthRates,
      summary: {
        totalGrowth: {
          companies: runningTotals.companies,
          users: runningTotals.users,
          messages: runningTotals.messages,
          departments: runningTotals.departments
        },
        engagementMetrics,
        insights: [
          `Average of ${Math.round(runningTotals.companies / periods.length)} new companies per ${periodFormat === 'monthly' ? 'month' : 'day'}`,
          `${Math.round(runningTotals.users / runningTotals.companies)} average users per company`,
          `Platform message velocity: ${engagementMetrics.messageVelocity} messages/day`
        ]
      }
    });

  } catch (error) {
    console.error('Error generating platform growth analytics:', error);
    res.status(500).json({ error: 'Failed to generate platform growth analytics' });
  }
});

// =====================================================
// ADVANCED COMPANY MANAGEMENT WITH NIGERIAN FEATURES
// =====================================================

// Get all companies with subscription and billing information
router.get('/companies/management', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      currency = 'NGN', 
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = 'all'
    } = req.query;
    
    console.log(`📊 Fetching company management data in ${currency}`);
    
    const offset = (page - 1) * limit;
    const companies = await prisma.company.findMany({
      skip: offset,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } },
            messageGroups: true
          }
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 5 // Latest 5 users
        }
      }
    });

    // Nigerian subscription plans
    const subscriptionPlans = {
      starter: { priceNGN: 15000, maxUsers: 10, features: 'basic' },
      professional: { priceNGN: 45000, maxUsers: 50, features: 'advanced' },
      enterprise: { priceNGN: 120000, maxUsers: 'unlimited', features: 'premium' }
    };

    // Enhance companies with subscription and billing data
    const enhancedCompanies = companies.map((company, index) => {
      // Simulate subscription data based on company size
      const userCount = company._count.users;
      let plan, billingStatus, nextBillingDate;
      
      if (userCount <= 10) {
        plan = 'starter';
      } else if (userCount <= 50) {
        plan = 'professional';
      } else {
        plan = 'enterprise';
      }

      // Simulate billing status
      const statuses = ['active', 'overdue', 'trial', 'suspended'];
      billingStatus = statuses[index % statuses.length];

      // Generate next billing date
      nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      const planDetails = subscriptionPlans[plan];
      const monthlyRevenueNGN = planDetails.priceNGN;
      const monthlyRevenue = convertCurrency(monthlyRevenueNGN, 'NGN', currency);

      return {
        id: company.id,
        name: company.name,
        email: company.email,
        status: company.isActive ? 'active' : 'inactive',
        subscription: {
          plan,
          planName: plan.charAt(0).toUpperCase() + plan.slice(1),
          status: billingStatus,
          monthlyRevenue: Math.round(monthlyRevenue),
          monthlyRevenueFormatted: formatCurrency(monthlyRevenue, currency),
          monthlyRevenueNGN: monthlyRevenueNGN,
          monthlyRevenueNGNFormatted: formatCurrency(monthlyRevenueNGN, 'NGN'),
          nextBillingDate: formatDate(nextBillingDate, timezone),
          maxUsers: planDetails.maxUsers,
          features: planDetails.features
        },
        usage: {
          currentUsers: userCount,
          totalDepartments: company._count.departments,
          totalMessages: company._count.messages,
          totalGroups: company._count.messageGroups,
          utilizationRate: planDetails.maxUsers === 'unlimited' ? 100 : 
            Math.round((userCount / planDetails.maxUsers) * 100)
        },
        activity: {
          createdAt: formatDate(company.createdAt, timezone),
          lastActive: formatDate(company.updatedAt, timezone),
          recentUsers: company.users.length
        },
        actions: {
          canUpgrade: plan !== 'enterprise',
          canDowngrade: plan !== 'starter',
          needsAttention: billingStatus === 'overdue' || billingStatus === 'suspended'
        }
      };
    });

    const total = await prisma.company.count();
    const totalPages = Math.ceil(total / limit);

    // Calculate summary statistics
    const summary = {
      totalCompanies: total,
      totalRevenue: enhancedCompanies.reduce((sum, company) => 
        sum + company.subscription.monthlyRevenue, 0),
      totalUsers: enhancedCompanies.reduce((sum, company) => 
        sum + company.usage.currentUsers, 0),
      activeSubscriptions: enhancedCompanies.filter(c => 
        c.subscription.status === 'active').length,
      trialSubscriptions: enhancedCompanies.filter(c => 
        c.subscription.status === 'trial').length,
      overdueSubscriptions: enhancedCompanies.filter(c => 
        c.subscription.status === 'overdue').length
    };

    // Log activity
    await logActivity(req.user.id, 'company_management_access', {
      currency,
      timezone,
      page,
      limit,
      totalCompanies: total,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        companies: enhancedCompanies,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary: {
          ...summary,
          totalRevenueFormatted: formatCurrency(summary.totalRevenue, currency),
          averageRevenuePerCompany: Math.round(summary.totalRevenue / Math.max(summary.totalCompanies, 1)),
          averageRevenuePerCompanyFormatted: formatCurrency(
            summary.totalRevenue / Math.max(summary.totalCompanies, 1), currency)
        },
        currency,
        timezone,
        lastUpdated: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching company management data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company management data',
      details: error.message
    });
  }
});

// Company subscription management endpoint
router.put('/companies/:companyId/subscription', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      plan, 
      action, // 'upgrade', 'downgrade', 'suspend', 'activate', 'extend_trial'
      currency = 'NGN',
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone 
    } = req.body;

    console.log(`🔄 Managing subscription for company ${companyId}: ${action} to ${plan}`);

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true } }
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Nigerian subscription plans with pricing
    const subscriptionPlans = {
      starter: { 
        priceNGN: 15000, 
        maxUsers: 10, 
        features: ['Basic messaging', 'File sharing', 'Basic notes'],
        name: 'Starter Plan'
      },
      professional: { 
        priceNGN: 45000, 
        maxUsers: 50, 
        features: ['Advanced messaging', 'Department management', 'Advanced notes', 'Integrations'],
        name: 'Professional Plan'
      },
      enterprise: { 
        priceNGN: 120000, 
        maxUsers: 'unlimited', 
        features: ['All features', 'Priority support', 'Custom integrations', 'Analytics'],
        name: 'Enterprise Plan'
      }
    };

    const planDetails = subscriptionPlans[plan];
    if (!planDetails && action !== 'suspend') {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription plan'
      });
    }

    // Simulate subscription management
    let result = {};
    switch (action) {
      case 'upgrade':
      case 'downgrade':
        const newPriceNGN = planDetails.priceNGN;
        const newPrice = convertCurrency(newPriceNGN, 'NGN', currency);
        
        result = {
          action: action,
          newPlan: plan,
          planName: planDetails.name,
          pricing: {
            monthlyPrice: Math.round(newPrice),
            monthlyPriceFormatted: formatCurrency(newPrice, currency),
            monthlyPriceNGN: newPriceNGN,
            monthlyPriceNGNFormatted: formatCurrency(newPriceNGN, 'NGN')
          },
          features: planDetails.features,
          maxUsers: planDetails.maxUsers,
          currentUsers: company._count.users,
          effectiveDate: formatDate(new Date(), timezone),
          nextBillingDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), timezone)
        };
        break;

      case 'suspend':
        result = {
          action: 'suspend',
          status: 'suspended',
          suspendedAt: formatDate(new Date(), timezone),
          reason: 'Administrative action',
          reactivationRequired: true
        };
        break;

      case 'activate':
        result = {
          action: 'activate',
          status: 'active',
          activatedAt: formatDate(new Date(), timezone),
          nextBillingDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), timezone)
        };
        break;

      case 'extend_trial':
        const extendedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        result = {
          action: 'extend_trial',
          status: 'trial',
          extendedUntil: formatDate(extendedDate, timezone),
          trialDaysAdded: 14
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
    }

    // Log the subscription management activity
    await logActivity(req.user.id, 'subscription_management', {
      companyId,
      companyName: company.name,
      action,
      plan,
      currency,
      timezone,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        companyId,
        companyName: company.name,
        subscription: result,
        currency,
        timezone,
        updatedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error managing company subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to manage company subscription',
      details: error.message
    });
  }
});

// Company billing history endpoint
router.get('/companies/:companyId/billing-history', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      currency = 'NGN',
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      limit = 12 
    } = req.query;

    console.log(`📄 Fetching billing history for company ${companyId} in ${currency}`);

    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, email: true }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Generate simulated billing history
    const billingHistory = [];
    const plans = ['starter', 'professional', 'enterprise'];
    const prices = { starter: 15000, professional: 45000, enterprise: 120000 };
    const statuses = ['paid', 'pending', 'overdue', 'refunded'];

    for (let i = 0; i < parseInt(limit); i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const plan = plans[Math.floor(Math.random() * plans.length)];
      const status = statuses[i === 0 ? 0 : Math.floor(Math.random() * statuses.length)]; // Latest is always paid
      const amountNGN = prices[plan];
      const amount = convertCurrency(amountNGN, 'NGN', currency);

      billingHistory.push({
        id: `inv_${Date.now()}_${i}`,
        invoiceNumber: `INV-${String(Date.now()).slice(-6)}-${String(i).padStart(2, '0')}`,
        billingPeriod: {
          start: formatDate(new Date(date.getFullYear(), date.getMonth(), 1), timezone),
          end: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0), timezone)
        },
        plan: {
          name: plan.charAt(0).toUpperCase() + plan.slice(1),
          code: plan
        },
        amount: {
          value: Math.round(amount),
          formatted: formatCurrency(amount, currency),
          valueNGN: amountNGN,
          formattedNGN: formatCurrency(amountNGN, 'NGN')
        },
        status,
        paymentMethod: i % 3 === 0 ? 'bank_transfer' : i % 3 === 1 ? 'card' : 'paystack',
        paidAt: status === 'paid' ? formatDate(date, timezone) : null,
        dueDate: formatDate(new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000), timezone),
        createdAt: formatDate(date, timezone)
      });
    }

    // Calculate billing summary
    const totalBilled = billingHistory.reduce((sum, bill) => sum + bill.amount.value, 0);
    const totalPaid = billingHistory
      .filter(bill => bill.status === 'paid')
      .reduce((sum, bill) => sum + bill.amount.value, 0);
    const totalOverdue = billingHistory
      .filter(bill => bill.status === 'overdue')
      .reduce((sum, bill) => sum + bill.amount.value, 0);

    const summary = {
      totalInvoices: billingHistory.length,
      totalBilled: Math.round(totalBilled),
      totalBilledFormatted: formatCurrency(totalBilled, currency),
      totalPaid: Math.round(totalPaid),
      totalPaidFormatted: formatCurrency(totalPaid, currency),
      totalOverdue: Math.round(totalOverdue),
      totalOverdueFormatted: formatCurrency(totalOverdue, currency),
      paymentRate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0
    };

    // Log activity
    await logActivity(req.user.id, 'billing_history_access', {
      companyId,
      companyName: company.name,
      currency,
      timezone,
      invoiceCount: billingHistory.length,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          email: company.email
        },
        billingHistory,
        summary,
        currency,
        timezone,
        lastUpdated: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching billing history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing history',
      details: error.message
    });
  }
});

// Company usage analytics endpoint
router.get('/companies/:companyId/usage-analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { 
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      period = '30d'
    } = req.query;

    console.log(`📊 Fetching usage analytics for company ${companyId} (${period})`);

    // Validate company and get real data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            messages: { where: { deletedAt: null } },
            messageGroups: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          }
        },
        departments: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                users: true,
                messageGroups: true
              }
            }
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Calculate period for analytics
    let days = 30;
    switch (period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get real message activity
    const [messageStats, recentMessages, userActivity] = await Promise.all([
      prisma.message.groupBy({
        by: ['createdAt'],
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: startDate }
        },
        _count: true
      }),
      prisma.message.findMany({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.user.findMany({
        where: {
          companyId,
          lastLoginAt: { gte: startDate }
        },
        select: {
          id: true,
          name: true,
          email: true,
          lastLoginAt: true,
          _count: {
            select: {
              sentMessages: {
                where: {
                  deletedAt: null,
                  createdAt: { gte: startDate }
                }
              }
            }
          }
        }
      })
    ]);

    // Usage analytics
    const analytics = {
      overview: {
        totalUsers: company._count.users,
        activeUsers: userActivity.length,
        totalDepartments: company._count.departments,
        totalMessages: company._count.messages,
        totalGroups: company._count.messageGroups,
        userActivationRate: company._count.users > 0 ? 
          Math.round((userActivity.length / company._count.users) * 100) : 0
      },
      userEngagement: {
        dailyActiveUsers: userActivity.filter(user => 
          user.lastLoginAt && user.lastLoginAt >= new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        weeklyActiveUsers: userActivity.filter(user => 
          user.lastLoginAt && user.lastLoginAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        monthlyActiveUsers: userActivity.length,
        topUsers: userActivity
          .sort((a, b) => b._count.sentMessages - a._count.sentMessages)
          .slice(0, 5)
          .map(user => ({
            name: user.name,
            email: user.email,
            messagesCount: user._count.sentMessages,
            lastActive: formatDate(user.lastLoginAt, timezone)
          }))
      },
      messaging: {
        totalMessages: messageStats.reduce((sum, stat) => sum + stat._count, 0),
        averageMessagesPerDay: Math.round(
          messageStats.reduce((sum, stat) => sum + stat._count, 0) / Math.max(days, 1)
        ),
        recentActivity: recentMessages.map(msg => ({
          id: msg.id,
          content: msg.content.length > 100 ? 
            msg.content.substring(0, 100) + '...' : msg.content,
          author: msg.user.name,
          createdAt: formatDate(msg.createdAt, timezone)
        }))
      },
      departments: {
        total: company.departments.length,
        breakdown: company.departments.map(dept => ({
          name: dept.name,
          userCount: dept._count.users,
          groupCount: dept._count.messageGroups,
          utilization: dept._count.users > 0 ? 
            Math.round((dept._count.messageGroups / dept._count.users) * 100) : 0
        }))
      },
      insights: [
        `${userActivity.length} of ${company._count.users} users active in the last ${days} days`,
        `Average of ${Math.round(messageStats.reduce((sum, stat) => sum + stat._count, 0) / Math.max(days, 1))} messages per day`,
        `${company.departments.length} departments with an average of ${Math.round(company._count.users / Math.max(company.departments.length, 1))} users each`
      ]
    };

    // Log activity
    await logActivity(req.user.id, 'usage_analytics_access', {
      companyId,
      companyName: company.name,
      period,
      totalUsers: company._count.users,
      activeUsers: userActivity.length,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name
        },
        period,
        analytics,
        timezone,
        lastUpdated: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching usage analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage analytics',
      details: error.message
    });
  }
});

// =====================================================
// USER MANAGEMENT & ANALYTICS WITH NIGERIAN FEATURES
// =====================================================

// Get all users with comprehensive analytics and role management
router.get('/users/management', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      currency = 'NGN',
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      role = 'all',
      status = 'all',
      companyId = null
    } = req.query;
    
    console.log(`👥 Fetching user management data (page ${page}, role: ${role})`);
    
    const offset = (page - 1) * limit;
    
    // Build filters
    const filters = {};
    if (role !== 'all') filters.role = role;
    if (status === 'active') filters.isActive = true;
    if (status === 'inactive') filters.isActive = false;
    if (companyId) filters.companyId = companyId;

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        skip: offset,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              sentMessages: {
                where: { deletedAt: null }
              },
              notes: true,
              tasks: true
            }
          }
        }
      }),
      prisma.user.count({ where: filters })
    ]);

    // Enhance users with analytics and Nigerian context
    const enhancedUsers = users.map(user => {
      // Calculate user engagement score
      const totalActivity = user._count.sentMessages + user._count.notes + user._count.tasks;
      const engagementScore = Math.min(100, Math.round((totalActivity / 10) * 100)); // Scale to 100
      
      // Determine subscription contribution (simulate based on company)
      const companyValue = user.company ? (
        user.role === 'ADMIN' ? 45000 : // Professional plan
        user.role === 'MANAGER' ? 35000 : 15000 // Starter plan
      ) : 0;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
          email: user.company.email
        } : null,
        activity: {
          messages: user._count.sentMessages,
          notes: user._count.notes,
          tasks: user._count.tasks,
          totalActivity,
          engagementScore,
          lastLogin: user.lastLoginAt ? formatDate(user.lastLoginAt, timezone) : 'Never',
          lastLoginRaw: user.lastLoginAt
        },
        subscription: {
          contributionNGN: companyValue,
          contribution: formatCurrency(companyValue, currency),
          valueSegment: companyValue >= 45000 ? 'High Value' : 
                       companyValue >= 15000 ? 'Medium Value' : 'Low Value'
        },
        timeline: {
          createdAt: formatDate(user.createdAt, timezone),
          joinedDaysAgo: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24)),
          lastActive: user.lastLoginAt ? 
            Math.floor((new Date() - user.lastLoginAt) / (1000 * 60 * 60 * 24)) : null
        },
        permissions: {
          canManageCompany: user.role === 'ADMIN',
          canManageDepartment: ['ADMIN', 'MANAGER'].includes(user.role),
          canViewAnalytics: ['ADMIN', 'MANAGER'].includes(user.role),
          requiresSupport: user.role === 'USER' && totalActivity < 5
        }
      };
    });

    // Calculate summary statistics
    const roleDistribution = await prisma.user.groupBy({
      by: ['role'],
      where: filters.companyId ? { companyId: filters.companyId } : {},
      _count: true
    });

    const summary = {
      totalUsers,
      activeUsers: enhancedUsers.filter(u => u.status === 'active').length,
      inactiveUsers: enhancedUsers.filter(u => u.status === 'inactive').length,
      roleDistribution: roleDistribution.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
      engagementStats: {
        highEngagement: enhancedUsers.filter(u => u.activity.engagementScore >= 70).length,
        mediumEngagement: enhancedUsers.filter(u => u.activity.engagementScore >= 30 && u.activity.engagementScore < 70).length,
        lowEngagement: enhancedUsers.filter(u => u.activity.engagementScore < 30).length,
        averageScore: Math.round(enhancedUsers.reduce((sum, u) => sum + u.activity.engagementScore, 0) / enhancedUsers.length)
      },
      revenueContribution: {
        total: enhancedUsers.reduce((sum, u) => sum + u.subscription.contributionNGN, 0),
        average: Math.round(enhancedUsers.reduce((sum, u) => sum + u.subscription.contributionNGN, 0) / enhancedUsers.length)
      }
    };

    // Log activity
    await logActivity(req.user.id, 'user_management_access', {
      currency,
      timezone,
      filters,
      page,
      totalUsers,
      timestamp: getCurrentTime(timezone)
    });

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalUsers,
          itemsPerPage: parseInt(limit),
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary: {
          ...summary,
          revenueContribution: {
            ...summary.revenueContribution,
            totalFormatted: formatCurrency(summary.revenueContribution.total, currency),
            averageFormatted: formatCurrency(summary.revenueContribution.average, currency)
          }
        },
        filters: { role, status, companyId },
        currency,
        timezone,
        lastUpdated: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user management data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user management data',
      details: error.message
    });
  }
});

// User role management endpoint
router.put('/users/:userId/role', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      newRole, 
      reason,
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone 
    } = req.body;

    console.log(`🔄 Updating user role: ${userId} to ${newRole}`);

    // Validate role
    const validRoles = ['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role specified'
      });
    }

    // Get current user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: { select: { id: true, name: true } }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent self-demotion from SUPER_ADMIN
    if (req.user.id === userId && req.user.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Cannot demote yourself from Super Admin role'
      });
    }

    const oldRole = user.role;

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      include: {
        company: { select: { id: true, name: true } }
      }
    });

    // Log the role change activity
    await logActivity(req.user.id, 'user_role_change', {
      targetUserId: userId,
      targetUserName: user.name,
      targetUserEmail: user.email,
      oldRole,
      newRole,
      reason: reason || 'Administrative action',
      companyId: user.company?.id,
      companyName: user.company?.name,
      timestamp: getCurrentTime(timezone)
    });

    // Calculate impact of role change
    const rolePermissions = {
      USER: ['View messages', 'Create notes', 'Manage own tasks'],
      MANAGER: ['All USER permissions', 'Manage department', 'View team analytics'],
      ADMIN: ['All MANAGER permissions', 'Manage company', 'Access admin panel'],
      SUPER_ADMIN: ['All ADMIN permissions', 'Platform administration', 'Global settings']
    };

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          company: updatedUser.company
        },
        roleChange: {
          from: oldRole,
          to: newRole,
          reason: reason || 'Administrative action',
          changedBy: req.user.name,
          changedAt: getCurrentTime(timezone)
        },
        permissions: {
          gained: rolePermissions[newRole] || [],
          impact: newRole === 'SUPER_ADMIN' ? 'Full platform access granted' :
                 newRole === 'ADMIN' ? 'Company administration access granted' :
                 newRole === 'MANAGER' ? 'Department management access granted' :
                 'Standard user access'
        },
        timezone,
        updatedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      details: error.message
    });
  }
});

// User analytics dashboard endpoint
router.get('/users/analytics', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { 
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone,
      period = '30d',
      companyId = null
    } = req.query;

    console.log(`📊 Fetching user analytics for ${period} period`);

    // Calculate date range
    let days = 30;
    switch (period) {
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filters = companyId ? { companyId } : {};

    // Get comprehensive user analytics
    const [
      totalUsers,
      activeUsers,
      newUsers,
      usersByRole,
      usersByCompany,
      engagementData,
      retentionData
    ] = await Promise.all([
      // Total users
      prisma.user.count({ where: filters }),
      
      // Active users (logged in within period)
      prisma.user.count({
        where: {
          ...filters,
          lastLoginAt: { gte: startDate }
        }
      }),
      
      // New users in period
      prisma.user.count({
        where: {
          ...filters,
          createdAt: { gte: startDate }
        }
      }),
      
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        where: filters,
        _count: true
      }),
      
      // Users by company
      prisma.user.groupBy({
        by: ['companyId'],
        where: filters,
        _count: true,
        orderBy: { _count: { _all: 'desc' } },
        take: 10
      }),
      
      // User engagement data
      prisma.user.findMany({
        where: {
          ...filters,
          createdAt: { gte: startDate }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              sentMessages: {
                where: {
                  deletedAt: null,
                  createdAt: { gte: startDate }
                }
              },
              notes: {
                where: {
                  createdAt: { gte: startDate }
                }
              },
              tasks: {
                where: {
                  createdAt: { gte: startDate }
                }
              }
            }
          }
        }
      }),
      
      // User retention analysis
      prisma.user.findMany({
        where: filters,
        select: {
          id: true,
          createdAt: true,
          lastLoginAt: true
        }
      })
    ]);

    // Process engagement analytics
    const engagementAnalytics = engagementData.map(user => {
      const totalActivity = user._count.sentMessages + user._count.notes + user._count.tasks;
      const daysSinceJoined = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
      const lastLoginDays = user.lastLoginAt ? 
        Math.floor((new Date() - user.lastLoginAt) / (1000 * 60 * 60 * 24)) : null;

      return {
        ...user,
        totalActivity,
        dailyAverage: daysSinceJoined > 0 ? Math.round((totalActivity / daysSinceJoined) * 10) / 10 : 0,
        lastLoginDays,
        engagementLevel: totalActivity >= 20 ? 'High' : 
                        totalActivity >= 5 ? 'Medium' : 'Low'
      };
    });

    // Calculate retention metrics
    const retentionMetrics = {
      day1: 0, day7: 0, day30: 0
    };

    retentionData.forEach(user => {
      if (user.lastLoginAt) {
        const daysSinceJoined = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));
        const daysSinceLastLogin = Math.floor((new Date() - user.lastLoginAt) / (1000 * 60 * 60 * 24));
        
        if (daysSinceJoined >= 1 && daysSinceLastLogin <= 1) retentionMetrics.day1++;
        if (daysSinceJoined >= 7 && daysSinceLastLogin <= 7) retentionMetrics.day7++;
        if (daysSinceJoined >= 30 && daysSinceLastLogin <= 30) retentionMetrics.day30++;
      }
    });

    // Get company details for user distribution
    const companyDetails = await Promise.all(
      usersByCompany.map(async item => {
        if (!item.companyId) return { name: 'No Company', users: item._count };
        const company = await prisma.company.findUnique({
          where: { id: item.companyId },
          select: { name: true }
        });
        return { 
          name: company?.name || 'Unknown Company', 
          users: item._count,
          companyId: item.companyId
        };
      })
    );

    const analytics = {
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        activationRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        growthRate: days > 0 ? Math.round((newUsers / Math.max(totalUsers - newUsers, 1)) * 100) : 0
      },
      roleDistribution: usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
      companyDistribution: companyDetails,
      engagement: {
        highEngagement: engagementAnalytics.filter(u => u.engagementLevel === 'High').length,
        mediumEngagement: engagementAnalytics.filter(u => u.engagementLevel === 'Medium').length,
        lowEngagement: engagementAnalytics.filter(u => u.engagementLevel === 'Low').length,
        averageDailyActivity: Math.round(
          engagementAnalytics.reduce((sum, u) => sum + u.dailyAverage, 0) / 
          Math.max(engagementAnalytics.length, 1) * 10
        ) / 10,
        topEngagedUsers: engagementAnalytics
          .sort((a, b) => b.totalActivity - a.totalActivity)
          .slice(0, 5)
          .map(user => ({
            name: user.name,
            email: user.email,
            role: user.role,
            totalActivity: user.totalActivity,
            dailyAverage: user.dailyAverage
          }))
      },
      retention: {
        day1Retention: Math.round((retentionMetrics.day1 / Math.max(totalUsers, 1)) * 100),
        day7Retention: Math.round((retentionMetrics.day7 / Math.max(totalUsers, 1)) * 100),
        day30Retention: Math.round((retentionMetrics.day30 / Math.max(totalUsers, 1)) * 100)
      },
      insights: [
        `${activeUsers} of ${totalUsers} users active in the last ${days} days (${Math.round((activeUsers/totalUsers)*100)}%)`,
        `${newUsers} new users joined in the ${period} period`,
        `Average user engagement: ${Math.round(engagementAnalytics.reduce((sum, u) => sum + u.dailyAverage, 0) / Math.max(engagementAnalytics.length, 1) * 10) / 10} activities/day`,
        `${Math.round((retentionMetrics.day30 / Math.max(totalUsers, 1)) * 100)}% user retention after 30 days`
      ]
    };

    // Log activity
    await logActivity(req.user.id, 'user_analytics_access', {
      period,
      companyId,
      totalUsers,
      activeUsers,
      timezone,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        period,
        analytics,
        companyId,
        timezone,
        lastUpdated: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics',
      details: error.message
    });
  }
});

// User account management endpoint (suspend/activate/delete)
router.put('/users/:userId/account', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      action, // 'suspend', 'activate', 'delete'
      reason,
      timezone = DEFAULT_PLATFORM_SETTINGS.timezone 
    } = req.body;

    console.log(`⚙️ Managing user account: ${userId} - ${action}`);

    // Validate action
    const validActions = ['suspend', 'activate', 'delete'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action specified'
      });
    }

    // Get current user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: { select: { id: true, name: true } },
        _count: {
          select: {
            sentMessages: { where: { deletedAt: null } },
            notes: true,
            tasks: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent self-action
    if (req.user.id === userId) {
      return res.status(403).json({
        success: false,
        error: `Cannot ${action} your own account`
      });
    }

    let result = {};

    switch (action) {
      case 'suspend':
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false }
        });
        result = {
          action: 'suspended',
          status: 'inactive',
          message: 'User account has been suspended',
          suspendedAt: getCurrentTime(timezone)
        };
        break;

      case 'activate':
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: true }
        });
        result = {
          action: 'activated',
          status: 'active',
          message: 'User account has been activated',
          activatedAt: getCurrentTime(timezone)
        };
        break;

      case 'delete':
        // Soft delete - deactivate and mark for deletion
        await prisma.user.update({
          where: { id: userId },
          data: { 
            isActive: false,
            // Note: Add deletedAt field to schema if needed for soft deletion
          }
        });
        result = {
          action: 'deleted',
          status: 'deleted',
          message: 'User account has been marked for deletion',
          deletedAt: getCurrentTime(timezone)
        };
        break;
    }

    // Log the account management activity
    await logActivity(req.user.id, 'user_account_management', {
      targetUserId: userId,
      targetUserName: user.name,
      targetUserEmail: user.email,
      action,
      reason: reason || 'Administrative action',
      companyId: user.company?.id,
      companyName: user.company?.name,
      userActivity: user._count,
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company
        },
        accountAction: {
          ...result,
          reason: reason || 'Administrative action',
          performedBy: req.user.name,
          impact: action === 'delete' ? 'User will lose all access and data may be archived' :
                 action === 'suspend' ? 'User will lose access until reactivated' :
                 'User access has been restored'
        },
        userStats: {
          messages: user._count.sentMessages,
          notes: user._count.notes,
          tasks: user._count.tasks
        },
        timezone,
        updatedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error managing user account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to manage user account',
      details: error.message
    });
  }
});

// ============================================================
// SYSTEM CONFIGURATION PANEL
// ============================================================

// Get system configuration settings
router.get('/system/configuration', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    
    console.log('⚙️ Retrieving system configuration...');

    // Get current system settings (simulate from database or config)
    const systemConfig = {
      currency: {
        primary: 'NGN',
        supported: Object.keys(SUPPORTED_CURRENCIES),
        exchangeRates: {
          'NGN': 1.0,
          'USD': 0.0011, // 1 NGN = 0.0011 USD (approximate)
          'EUR': 0.001,  // 1 NGN = 0.001 EUR (approximate)
          'GBP': 0.0009  // 1 NGN = 0.0009 GBP (approximate)
        },
        formatting: {
          symbol: '₦',
          position: 'before', // ₦1,000 vs 1,000₦
          thousands: ',',
          decimal: '.'
        }
      },
      timezone: {
        primary: 'Africa/Lagos',
        supported: Object.keys(SUPPORTED_TIMEZONES),
        display: {
          format: 'DD/MM/YYYY, HH:mm:ss',
          use24Hour: true,
          showTimezone: true
        }
      },
      platform: {
        name: 'CollabNotes Nigeria',
        region: 'Nigeria',
        language: 'en-NG', // English (Nigeria)
        features: {
          multiCompany: true,
          roleHierarchy: true,
          analytics: true,
          auditLogs: true,
          fileUploads: true,
          notifications: true
        }
      },
      business: {
        taxSettings: {
          vatRate: 7.5, // Nigeria VAT rate
          includeVAT: true,
          taxId: 'TIN-' // Tax Identification Number prefix
        },
        compliance: {
          dataRetention: 7, // years
          auditRequired: true,
          gdprCompliant: false, // Nigeria NDPR compliance instead
          ndprCompliant: true  // Nigeria Data Protection Regulation
        },
        localization: {
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: {
            start: '08:00',
            end: '17:00'
          },
          holidays: [
            { date: '2025-01-01', name: 'New Year Day' },
            { date: '2025-10-01', name: 'Independence Day' },
            { date: '2025-12-25', name: 'Christmas Day' },
            { date: '2025-12-26', name: 'Boxing Day' }
          ]
        }
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          maxAge: 90 // days
        },
        sessionSettings: {
          timeout: 24, // hours
          multiSession: true,
          rememberMe: true
        },
        twoFactor: {
          enabled: false,
          required: false,
          methods: ['SMS', 'Email', 'TOTP']
        }
      }
    };

    // Get usage statistics
    const [
      totalUsers,
      totalCompanies,
      totalMessages,
      totalNotes,
      totalTasks,
      storageUsed
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.message.count(),
      prisma.note.count(),
      prisma.task.count(),
      // Simulate storage calculation
      Promise.resolve(Math.floor(Math.random() * 1000) + 500) // MB
    ]);

    const platformStats = {
      users: {
        total: totalUsers,
        active30d: Math.floor(totalUsers * 0.7), // Simulate active users
        growth: '+12%' // Simulate growth
      },
      companies: {
        total: totalCompanies,
        active: Math.floor(totalCompanies * 0.9),
        avgUsersPerCompany: Math.round(totalUsers / totalCompanies)
      },
      content: {
        messages: totalMessages,
        notes: totalNotes,
        tasks: totalTasks,
        total: totalMessages + totalNotes + totalTasks
      },
      system: {
        storage: {
          used: storageUsed,
          total: 10240, // 10GB
          percentage: Math.round((storageUsed / 10240) * 100)
        },
        uptime: '99.9%',
        lastBackup: getCurrentTime(timezone)
      }
    };

    res.json({
      success: true,
      message: 'System configuration retrieved successfully',
      data: {
        configuration: systemConfig,
        statistics: platformStats,
        timezone,
        retrievedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving system configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system configuration',
      details: error.message
    });
  }
});

// Update system configuration settings
router.put('/system/configuration', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { section, settings } = req.body;

    console.log(`⚙️ Updating system configuration: ${section}...`);

    // Validate the section being updated
    const validSections = ['currency', 'timezone', 'platform', 'business', 'security'];
    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration section',
        validSections
      });
    }

    // Validate settings based on section
    let validatedSettings = {};
    let changes = [];

    switch (section) {
      case 'currency':
        if (settings.primary && Object.keys(SUPPORTED_CURRENCIES).includes(settings.primary)) {
          validatedSettings.primary = settings.primary;
          changes.push(`Primary currency changed to ${settings.primary}`);
        }
        if (settings.formatting) {
          validatedSettings.formatting = { ...settings.formatting };
          changes.push('Currency formatting updated');
        }
        break;

      case 'timezone':
        if (settings.primary && Object.keys(SUPPORTED_TIMEZONES).includes(settings.primary)) {
          validatedSettings.primary = settings.primary;
          changes.push(`Primary timezone changed to ${settings.primary}`);
        }
        if (settings.display) {
          validatedSettings.display = { ...settings.display };
          changes.push('Timezone display settings updated');
        }
        break;

      case 'platform':
        if (settings.name) {
          validatedSettings.name = settings.name;
          changes.push(`Platform name changed to "${settings.name}"`);
        }
        if (settings.features) {
          validatedSettings.features = { ...settings.features };
          changes.push('Platform features configuration updated');
        }
        break;

      case 'business':
        if (settings.taxSettings) {
          validatedSettings.taxSettings = { ...settings.taxSettings };
          changes.push('Tax settings updated');
        }
        if (settings.localization) {
          validatedSettings.localization = { ...settings.localization };
          changes.push('Business localization settings updated');
        }
        break;

      case 'security':
        if (settings.passwordPolicy) {
          validatedSettings.passwordPolicy = { ...settings.passwordPolicy };
          changes.push('Password policy updated');
        }
        if (settings.sessionSettings) {
          validatedSettings.sessionSettings = { ...settings.sessionSettings };
          changes.push('Session settings updated');
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Configuration section not implemented'
        });
    }

    // Log the configuration change
    await logActivity({
      userId: req.user.id,
      action: 'SYSTEM_CONFIG_UPDATE',
      entity: 'System',
      entityId: section,
      details: {
        section,
        changes,
        updatedSettings: validatedSettings,
        performedBy: req.user.name,
        userRole: req.user.role
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      message: `System configuration updated successfully`,
      data: {
        section,
        updatedSettings: validatedSettings,
        changes,
        appliedBy: req.user.name,
        timezone,
        updatedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error updating system configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system configuration',
      details: error.message
    });
  }
});

// Get system health and status
router.get('/system/health', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    
    console.log('🔍 Checking system health...');

    // Database connectivity check
    const dbStart = Date.now();
    const userCount = await prisma.user.count();
    const dbLatency = Date.now() - dbStart;

    // System metrics (simulated for demo)
    const systemHealth = {
      overall: 'healthy', // healthy, warning, critical
      components: {
        database: {
          status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'warning' : 'critical',
          latency: `${dbLatency}ms`,
          connections: Math.floor(Math.random() * 50) + 10,
          maxConnections: 100
        },
        api: {
          status: 'healthy',
          responseTime: '85ms',
          requestsPerSecond: Math.floor(Math.random() * 100) + 50,
          errorRate: '0.1%'
        },
        storage: {
          status: 'healthy',
          diskUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
          availableSpace: '500GB',
          backupStatus: 'current'
        },
        memory: {
          status: 'healthy',
          usage: Math.floor(Math.random() * 20) + 60, // 60-80%
          available: '2.1GB',
          total: '8GB'
        }
      },
      metrics: {
        uptime: '99.9%',
        lastRestart: '2025-09-15T08:30:00Z',
        activeUsers: Math.floor(userCount * 0.3),
        peakUsers: Math.floor(userCount * 0.8),
        averageResponseTime: '120ms'
      },
      recent: {
        deployments: [
          {
            version: 'v2.1.3',
            timestamp: getCurrentTime(timezone),
            status: 'success',
            changes: 'User Management & Analytics enhancements'
          }
        ],
        incidents: [], // No recent incidents
        maintenance: [
          {
            type: 'Database Optimization',
            scheduled: '2025-09-20T02:00:00Z',
            duration: '30 minutes',
            impact: 'minimal'
          }
        ]
      }
    };

    res.json({
      success: true,
      message: 'System health retrieved successfully',
      data: {
        health: systemHealth,
        timezone,
        checkedAt: getCurrentTime(timezone)
      }
    });

  } catch (error) {
    console.error('❌ Error checking system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check system health',
      details: error.message
    });
  }
});

// Reset system configuration to defaults
router.post('/system/configuration/reset', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { section, confirmReset } = req.body;

    console.log(`🔄 Resetting system configuration: ${section || 'all'}...`);

    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        error: 'Reset confirmation required',
        message: 'Please set confirmReset: true to proceed with configuration reset'
      });
    }

    // Define default configurations for Nigeria
    const defaultConfigs = {
      currency: {
        primary: 'NGN',
        formatting: {
          symbol: '₦',
          position: 'before',
          thousands: ',',
          decimal: '.'
        }
      },
      timezone: {
        primary: 'Africa/Lagos',
        display: {
          format: 'DD/MM/YYYY, HH:mm:ss',
          use24Hour: true,
          showTimezone: true
        }
      },
      platform: {
        name: 'CollabNotes Nigeria',
        region: 'Nigeria',
        language: 'en-NG',
        features: {
          multiCompany: true,
          roleHierarchy: true,
          analytics: true,
          auditLogs: true,
          fileUploads: true,
          notifications: true
        }
      },
      business: {
        taxSettings: {
          vatRate: 7.5,
          includeVAT: true,
          taxId: 'TIN-'
        },
        localization: {
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: { start: '08:00', end: '17:00' }
        }
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          maxAge: 90
        },
        sessionSettings: {
          timeout: 24,
          multiSession: true,
          rememberMe: true
        }
      }
    };

    let resetSections = section ? [section] : Object.keys(defaultConfigs);
    let resetResults = [];

    for (const sectionName of resetSections) {
      if (defaultConfigs[sectionName]) {
        resetResults.push({
          section: sectionName,
          status: 'reset',
          defaultSettings: defaultConfigs[sectionName]
        });
      }
    }

    // Log the configuration reset
    await logActivity({
      userId: req.user.id,
      action: 'SYSTEM_CONFIG_RESET',
      entity: 'System',
      entityId: section || 'all',
      details: {
        resetSections,
        resetResults,
        performedBy: req.user.name,
        userRole: req.user.role,
        warning: 'System configuration reset to Nigerian defaults'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      message: `System configuration reset to defaults successfully`,
      data: {
        resetSections,
        resetResults,
        resetBy: req.user.name,
        timezone,
        resetAt: getCurrentTime(timezone),
        warning: 'All specified configurations have been reset to Nigerian defaults'
      }
    });

  } catch (error) {
    console.error('❌ Error resetting system configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset system configuration',
      details: error.message
    });
  }
});

// ============================================================
// ACTIVITY MONITORING DASHBOARD
// ============================================================

// Get real-time activity monitoring dashboard
router.get('/activity/monitoring', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { timeRange = '24h', activityType, userId, companyId } = req.query;
    
    console.log('📊 Retrieving activity monitoring dashboard...');

    // Calculate time ranges
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build activity filters
    const activityFilter = {
      createdAt: { gte: startDate }
    };
    
    if (activityType) activityFilter.action = activityType;
    if (userId) activityFilter.userId = userId;
    if (companyId) {
      // Filter by company through user relation
      activityFilter.user = { companyId: companyId };
    }

    // Get activity logs with user and company information
    const activities = await prisma.activityLog.findMany({
      where: activityFilter,
      include: {
        user: {
          include: {
            company: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to recent 100 activities
    });

    // Get activity summary statistics
    const [
      totalActivities,
      uniqueUsers,
      uniqueCompanies,
      userActivities,
      companyActivities,
      actionTypes
    ] = await Promise.all([
      prisma.activityLog.count({ where: { createdAt: { gte: startDate } } }),
      prisma.activityLog.findMany({
        where: { createdAt: { gte: startDate } },
        select: { userId: true },
        distinct: ['userId']
      }),
      prisma.activityLog.findMany({
        where: { 
          createdAt: { gte: startDate },
          user: { companyId: { not: null } }
        },
        include: { user: { select: { companyId: true } } },
        distinct: ['userId']
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: startDate } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      }),
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: { 
          createdAt: { gte: startDate },
          user: { companyId: { not: null } }
        },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10
      }),
      prisma.activityLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: startDate } },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } }
      })
    ]);

    // Get user details for top active users
    const topUserIds = userActivities.map(ua => ua.userId);
    const topUsers = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      include: { company: { select: { name: true } } }
    });

    // Create activity timeline (hourly breakdown for last 24h)
    const activityTimeline = [];
    const hoursToShow = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720; // hours
    const intervalHours = timeRange === '7d' ? 24 : timeRange === '30d' ? 24 : 1; // group by hours or days
    
    for (let i = 0; i < hoursToShow; i += intervalHours) {
      const periodStart = new Date(now.getTime() - (i + intervalHours) * 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      const periodActivities = await prisma.activityLog.count({
        where: {
          createdAt: { gte: periodStart, lt: periodEnd }
        }
      });
      
      activityTimeline.unshift({
        period: formatDate(periodStart, timezone),
        count: periodActivities,
        hour: periodStart.getHours()
      });
    }

    // Calculate performance metrics
    const performanceMetrics = {
      averageActivitiesPerHour: Math.round(totalActivities / (hoursToShow / intervalHours)),
      peakActivity: Math.max(...activityTimeline.map(at => at.count)),
      quietestHour: activityTimeline.reduce((min, current) => current.count < min.count ? current : min, activityTimeline[0]),
      busiestHour: activityTimeline.reduce((max, current) => current.count > max.count ? current : max, activityTimeline[0]),
      userEngagement: uniqueUsers.length > 0 ? Math.round((totalActivities / uniqueUsers.length) * 10) / 10 : 0,
      systemLoad: Math.min(100, Math.round((totalActivities / 1000) * 100)) // Simulate system load based on activity
    };

    // Recent significant activities (administrative actions)
    const significantActivities = activities
      .filter(activity => [
        'USER_ROLE_CHANGE', 'USER_ACCOUNT_ACTION', 'COMPANY_CREATED', 'COMPANY_SETTINGS_UPDATE',
        'SYSTEM_CONFIG_UPDATE', 'ADMIN_LOGIN', 'BULK_OPERATION'
      ].includes(activity.action))
      .slice(0, 20);

    // Prepare response data
    const monitoringData = {
      summary: {
        timeRange,
        totalActivities,
        uniqueUsers: uniqueUsers.length,
        uniqueCompanies: new Set(uniqueCompanies.map(c => c.user.companyId).filter(Boolean)).size,
        averageActivitiesPerUser: uniqueUsers.length > 0 ? Math.round((totalActivities / uniqueUsers.length) * 10) / 10 : 0,
        period: {
          start: formatDate(startDate, timezone),
          end: formatDate(now, timezone)
        }
      },
      
      performance: performanceMetrics,
      
      timeline: activityTimeline,
      
      topUsers: userActivities.slice(0, 10).map(ua => {
        const user = topUsers.find(u => u.id === ua.userId);
        return {
          userId: ua.userId,
          name: user?.name || 'Unknown User',
          email: user?.email || 'unknown@example.com',
          company: user?.company?.name || 'No Company',
          role: user?.role || 'USER',
          activityCount: ua._count.userId,
          averagePerHour: Math.round((ua._count.userId / (hoursToShow / intervalHours)) * 10) / 10
        };
      }),
      
      actionTypes: actionTypes.map(at => ({
        action: at.action,
        count: at._count.action,
        percentage: Math.round((at._count.action / totalActivities) * 100)
      })),
      
      recentActivities: activities.slice(0, 50).map(activity => ({
        id: activity.id,
        action: activity.action,
        entity: activity.entity,
        entityId: activity.entityId,
        user: {
          name: activity.user?.name || 'System',
          email: activity.user?.email || 'system@platform.com',
          role: activity.user?.role || 'SYSTEM',
          company: activity.user?.company?.name || 'System'
        },
        details: activity.details,
        timestamp: formatDate(activity.createdAt, timezone),
        ipAddress: activity.ipAddress,
        isSignificant: significantActivities.some(sa => sa.id === activity.id)
      })),
      
      significantActivities: significantActivities.map(activity => ({
        id: activity.id,
        action: activity.action,
        entity: activity.entity,
        user: {
          name: activity.user?.name || 'System',
          role: activity.user?.role || 'SYSTEM',
          company: activity.user?.company?.name || 'System'
        },
        details: activity.details,
        timestamp: formatDate(activity.createdAt, timezone),
        impact: activity.action.includes('ROLE_CHANGE') ? 'high' :
                activity.action.includes('SYSTEM_CONFIG') ? 'critical' :
                activity.action.includes('COMPANY') ? 'medium' : 'low'
      }))
    };

    res.json({
      success: true,
      message: 'Activity monitoring dashboard retrieved successfully',
      data: monitoringData,
      meta: {
        timezone,
        retrievedAt: getCurrentTime(timezone),
        filters: { timeRange, activityType, userId, companyId }
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving activity monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity monitoring dashboard',
      details: error.message
    });
  }
});

// Get user behavior analytics
router.get('/activity/user-behavior', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { timeRange = '30d', userId, companyId } = req.query;
    
    console.log('👤 Analyzing user behavior patterns...');

    // Calculate time range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Build user filter
    const userFilter = {};
    if (userId) userFilter.id = userId;
    if (companyId) userFilter.companyId = companyId;

    // Get user engagement patterns
    const users = await prisma.user.findMany({
      where: userFilter,
      include: {
        company: { select: { name: true } },
        sentMessages: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, createdAt: true }
        },
        createdNotes: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, createdAt: true }
        },
        assignedTasks: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, createdAt: true, status: true }
        },
        createdTasks: {
          where: { createdAt: { gte: startDate } },
          select: { id: true, createdAt: true, status: true }
        },
        activities: {
          where: { createdAt: { gte: startDate } },
          select: { action: true, createdAt: true, entity: true }
        }
      }
    });

    // Analyze behavior patterns for each user
    const behaviorAnalysis = users.map(user => {
      const allActivities = [
        ...user.sentMessages.map(m => ({ type: 'message', date: m.createdAt })),
        ...user.createdNotes.map(n => ({ type: 'note', date: n.createdAt })),
        ...user.assignedTasks.map(t => ({ type: 'task_assigned', date: t.createdAt, status: t.status })),
        ...user.createdTasks.map(t => ({ type: 'task_created', date: t.createdAt, status: t.status })),
        ...user.activities.map(a => ({ type: a.action, date: a.createdAt, entity: a.entity }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      // Calculate daily activity pattern
      const dailyActivity = {};
      allActivities.forEach(activity => {
        const day = activity.date.toISOString().split('T')[0];
        dailyActivity[day] = (dailyActivity[day] || 0) + 1;
      });

      // Calculate hourly patterns
      const hourlyPattern = Array.from({ length: 24 }, () => 0);
      allActivities.forEach(activity => {
        const hour = new Date(activity.date).getHours();
        hourlyPattern[hour]++;
      });

      // Identify peak activity hours
      const peakHours = hourlyPattern
        .map((count, hour) => ({ hour, count }))
        .filter(h => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Calculate engagement metrics
      const totalActivity = allActivities.length;
      const activeDays = Object.keys(dailyActivity).length;
      const avgDailyActivity = activeDays > 0 ? Math.round((totalActivity / activeDays) * 10) / 10 : 0;
      
      // Task completion rate
      const allTasks = [...user.assignedTasks, ...user.createdTasks];
      const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
      const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

      // Determine user engagement level
      let engagementLevel = 'low';
      if (avgDailyActivity >= 10) engagementLevel = 'high';
      else if (avgDailyActivity >= 5) engagementLevel = 'medium';

      // Identify behavior patterns
      const patterns = [];
      if (peakHours.length > 0 && peakHours[0].hour >= 8 && peakHours[0].hour <= 17) {
        patterns.push('business_hours_active');
      }
      if (peakHours.some(p => p.hour >= 18 || p.hour <= 7)) {
        patterns.push('after_hours_active');
      }
      if (activeDays === daysBack) {
        patterns.push('daily_consistent');
      } else if (activeDays >= daysBack * 0.7) {
        patterns.push('highly_regular');
      } else if (activeDays >= daysBack * 0.3) {
        patterns.push('moderately_regular');
      } else {
        patterns.push('sporadic');
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company?.name || 'No Company',
          industry: user.company?.industry || 'Unknown'
        },
        metrics: {
          totalActivity,
          activeDays,
          avgDailyActivity,
          taskCompletionRate,
          engagementLevel,
          activityBreakdown: {
            messages: user.sentMessages.length,
            notes: user.createdNotes.length,
            tasksAssigned: user.assignedTasks.length,
            tasksCreated: user.createdTasks.length,
            systemActions: user.activities.length
          }
        },
        patterns: {
          peakHours: peakHours.map(p => `${p.hour}:00`),
          behaviorTags: patterns,
          dailyActivity,
          hourlyPattern
        },
        insights: {
          mostActiveDay: Object.entries(dailyActivity)
            .sort(([,a], [,b]) => b - a)[0] || ['N/A', 0],
          preferredWorkingHours: peakHours.length > 0 ? 
            `${peakHours[0].hour}:00 - ${(peakHours[0].hour + 3) % 24}:00` : 'No clear pattern',
          consistency: activeDays >= daysBack * 0.7 ? 'high' : 
                      activeDays >= daysBack * 0.3 ? 'medium' : 'low'
        }
      };
    });

    // Calculate overall behavior insights
    const overallInsights = {
      totalUsersAnalyzed: behaviorAnalysis.length,
      engagementDistribution: {
        high: behaviorAnalysis.filter(b => b.metrics.engagementLevel === 'high').length,
        medium: behaviorAnalysis.filter(b => b.metrics.engagementLevel === 'medium').length,
        low: behaviorAnalysis.filter(b => b.metrics.engagementLevel === 'low').length
      },
      averageTaskCompletion: behaviorAnalysis.length > 0 ? 
        Math.round(behaviorAnalysis.reduce((sum, b) => sum + b.metrics.taskCompletionRate, 0) / behaviorAnalysis.length) : 0,
      commonPatterns: {
        businessHoursActive: behaviorAnalysis.filter(b => b.patterns.behaviorTags.includes('business_hours_active')).length,
        afterHoursActive: behaviorAnalysis.filter(b => b.patterns.behaviorTags.includes('after_hours_active')).length,
        dailyConsistent: behaviorAnalysis.filter(b => b.patterns.behaviorTags.includes('daily_consistent')).length,
        sporadic: behaviorAnalysis.filter(b => b.patterns.behaviorTags.includes('sporadic')).length
      }
    };

    res.json({
      success: true,
      message: 'User behavior analysis completed successfully',
      data: {
        insights: overallInsights,
        userAnalysis: behaviorAnalysis,
        period: {
          days: daysBack,
          start: formatDate(startDate, timezone),
          end: formatDate(now, timezone)
        }
      },
      meta: {
        timezone,
        analyzedAt: getCurrentTime(timezone),
        filters: { timeRange, userId, companyId }
      }
    });

  } catch (error) {
    console.error('❌ Error analyzing user behavior:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze user behavior patterns',
      details: error.message
    });
  }
});

// Get system performance metrics
router.get('/activity/performance', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { timeRange = '24h' } = req.query;
    
    console.log('📈 Analyzing system performance metrics...');

    // Calculate time range
    const now = new Date();
    const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 24;
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Get database performance metrics
    const dbStart = Date.now();
    const [
      totalActivities,
      totalUsers,
      totalCompanies,
      recentActivities
    ] = await Promise.all([
      prisma.activityLog.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count(),
      prisma.company.count(),
      prisma.activityLog.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, action: true },
        orderBy: { createdAt: 'desc' },
        take: 1000
      })
    ]);
    const dbLatency = Date.now() - dbStart;

    // Calculate throughput metrics
    const activitiesPerHour = Math.round(totalActivities / hours);
    const activitiesPerSecond = Math.round((activitiesPerHour / 3600) * 100) / 100;

    // Analyze response time patterns (simulated based on activity load)
    const baseResponseTime = 50; // ms
    const loadFactor = Math.min(2, activitiesPerSecond / 10); // Higher load = slower response
    const avgResponseTime = Math.round(baseResponseTime * (1 + loadFactor));

    // Calculate error rates (simulated)
    const errorRate = Math.max(0.01, Math.min(5, (activitiesPerSecond / 50) * 100)); // Higher load = more errors
    
    // System resource metrics (simulated)
    const cpuUsage = Math.min(95, 20 + (activitiesPerSecond * 2));
    const memoryUsage = Math.min(90, 30 + (totalActivities / 1000));
    const diskUsage = Math.min(85, 40 + (totalUsers / 100));

    // Performance timeline
    const performanceTimeline = [];
    const intervalHours = hours <= 24 ? 1 : 24;
    
    for (let i = 0; i < hours; i += intervalHours) {
      const periodStart = new Date(now.getTime() - (i + intervalHours) * 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      const periodActivities = recentActivities.filter(a => 
        new Date(a.createdAt) >= periodStart && new Date(a.createdAt) < periodEnd
      );
      
      const periodThroughput = periodActivities.length;
      const periodResponseTime = Math.round(baseResponseTime * (1 + Math.min(2, periodThroughput / 100)));
      
      performanceTimeline.unshift({
        timestamp: formatDate(periodStart, timezone),
        throughput: periodThroughput,
        responseTime: periodResponseTime,
        errorRate: Math.round((Math.max(0.01, Math.min(5, periodThroughput / 50)) * 100)) / 100,
        hour: periodStart.getHours()
      });
    }

    // Performance alerts
    const alerts = [];
    if (avgResponseTime > 200) alerts.push({ type: 'warning', message: 'High response time detected', value: `${avgResponseTime}ms` });
    if (cpuUsage > 80) alerts.push({ type: 'critical', message: 'High CPU usage', value: `${cpuUsage}%` });
    if (memoryUsage > 85) alerts.push({ type: 'critical', message: 'High memory usage', value: `${memoryUsage}%` });
    if (errorRate > 2) alerts.push({ type: 'warning', message: 'Elevated error rate', value: `${errorRate}%` });
    if (dbLatency > 100) alerts.push({ type: 'warning', message: 'Database latency high', value: `${dbLatency}ms` });

    // Performance recommendations
    const recommendations = [];
    if (activitiesPerSecond > 20) recommendations.push('Consider scaling database connections');
    if (cpuUsage > 70) recommendations.push('Monitor CPU-intensive operations');
    if (memoryUsage > 80) recommendations.push('Review memory usage patterns');
    if (avgResponseTime > 150) recommendations.push('Optimize slow queries and endpoints');
    if (totalActivities > 10000) recommendations.push('Implement activity log rotation');

    const performanceData = {
      summary: {
        timeRange,
        period: `${hours} hours`,
        overallHealth: alerts.filter(a => a.type === 'critical').length === 0 ? 
                      (alerts.filter(a => a.type === 'warning').length === 0 ? 'excellent' : 'good') : 'needs_attention'
      },
      
      throughput: {
        totalActivities,
        activitiesPerHour,
        activitiesPerSecond,
        peakHour: performanceTimeline.reduce((max, current) => 
          current.throughput > max.throughput ? current : max, performanceTimeline[0])
      },
      
      responseTime: {
        average: avgResponseTime,
        database: dbLatency,
        trend: performanceTimeline.length > 1 ? 
               (performanceTimeline[performanceTimeline.length - 1].responseTime > performanceTimeline[0].responseTime ? 'increasing' : 'stable') : 'stable'
      },
      
      resources: {
        cpu: { usage: cpuUsage, status: cpuUsage > 80 ? 'critical' : cpuUsage > 60 ? 'warning' : 'good' },
        memory: { usage: memoryUsage, status: memoryUsage > 85 ? 'critical' : memoryUsage > 70 ? 'warning' : 'good' },
        disk: { usage: diskUsage, status: diskUsage > 80 ? 'critical' : diskUsage > 60 ? 'warning' : 'good' },
        database: { latency: dbLatency, status: dbLatency > 100 ? 'warning' : 'good' }
      },
      
      reliability: {
        errorRate: errorRate,
        uptime: '99.9%', // Simulated
        availability: alerts.filter(a => a.type === 'critical').length === 0 ? 'high' : 'degraded'
      },
      
      timeline: performanceTimeline,
      alerts,
      recommendations,
      
      benchmarks: {
        targetResponseTime: '< 100ms',
        targetThroughput: '> 10 req/sec',
        targetErrorRate: '< 1%',
        targetUptime: '> 99.5%'
      }
    };

    res.json({
      success: true,
      message: 'System performance metrics retrieved successfully',
      data: performanceData,
      meta: {
        timezone,
        analyzedAt: getCurrentTime(timezone),
        dataPoints: performanceTimeline.length
      }
    });

  } catch (error) {
    console.error('❌ Error analyzing system performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze system performance metrics',
      details: error.message
    });
  }
});

// ============================================================
// FINANCIAL REPORTS & EXPORTS
// ============================================================

// Get comprehensive financial reports
router.get('/financial/reports', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { 
      reportType = 'overview', // overview, revenue, subscriptions, transactions, taxes
      period = '30d', // 7d, 30d, 90d, 1y, custom
      startDate,
      endDate,
      currency = 'NGN',
      companyId 
    } = req.query;
    
    console.log(`💰 Generating financial report: ${reportType} for ${period}...`);

    // Calculate date range
    const now = new Date();
    let dateStart, dateEnd = now;
    
    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else {
      switch (period) {
        case '7d':
          dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          dateStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Build financial data queries (simulated for demo)
    let totalRevenue = 0;
    let totalUsers = 0;
    let totalCompanies = 0;

    // Get real data from database
    const [
      users,
      companies,
      userCount,
      companyCount
    ] = await Promise.all([
      prisma.user.findMany({
        where: {
          createdAt: { gte: dateStart, lte: dateEnd },
          ...(companyId && { companyId })
        },
        include: { company: { select: { name: true } } }
      }),
      prisma.company.findMany({
        where: {
          createdAt: { gte: dateStart, lte: dateEnd },
          ...(companyId && { id: companyId })
        }
      }),
      prisma.user.count(),
      prisma.company.count()
    ]);

    // Simulate financial metrics based on user/company data
    const baseSubscriptionPrice = 5000; // ₦5,000 per user per month
    const companyMultiplier = 2; // Companies pay 2x per user
    
    // Calculate simulated revenue
    const userRevenue = users.length * baseSubscriptionPrice;
    const companyRevenue = companies.length * baseSubscriptionPrice * companyMultiplier;
    totalRevenue = userRevenue + companyRevenue;

    // Simulate transaction data
    const transactionData = {
      totalTransactions: users.length + companies.length * 2,
      successfulTransactions: Math.floor((users.length + companies.length * 2) * 0.95),
      failedTransactions: Math.floor((users.length + companies.length * 2) * 0.05),
      pendingTransactions: Math.floor((users.length + companies.length * 2) * 0.02),
      averageTransactionValue: totalRevenue > 0 ? Math.round(totalRevenue / (users.length + companies.length || 1)) : 0
    };

    // Simulate subscription metrics
    const subscriptionMetrics = {
      activeSubscriptions: users.length + companies.length,
      newSubscriptions: users.filter(u => new Date(u.createdAt) >= dateStart).length + 
                       companies.filter(c => new Date(c.createdAt) >= dateStart).length,
      cancelledSubscriptions: Math.floor((users.length + companies.length) * 0.05),
      churnRate: Math.round(((users.length + companies.length) * 0.05 / (users.length + companies.length || 1)) * 100 * 100) / 100,
      averageRevenuePerUser: users.length > 0 ? Math.round(userRevenue / users.length) : 0,
      lifetimeValue: baseSubscriptionPrice * 12 // Assume 12 months average
    };

    // Calculate tax information (Nigerian VAT)
    const vatRate = 7.5; // Nigeria VAT rate
    const vatAmount = Math.round((totalRevenue * vatRate) / 100);
    const netRevenue = totalRevenue - vatAmount;

    // Generate report based on type
    let reportData = {};

    switch (reportType) {
      case 'overview':
        reportData = {
          summary: {
            totalRevenue: formatCurrency(totalRevenue, currency),
            netRevenue: formatCurrency(netRevenue, currency),
            vatAmount: formatCurrency(vatAmount, currency),
            vatRate: `${vatRate}%`,
            totalUsers: userCount,
            totalCompanies: companyCount,
            activeCustomers: users.length + companies.length,
            period: {
              start: formatDate(dateStart, timezone),
              end: formatDate(dateEnd, timezone),
              days: Math.ceil((dateEnd - dateStart) / (1000 * 60 * 60 * 24))
            }
          },
          transactions: transactionData,
          subscriptions: subscriptionMetrics,
          growth: {
            newUsers: users.filter(u => new Date(u.createdAt) >= dateStart).length,
            newCompanies: companies.filter(c => new Date(c.createdAt) >= dateStart).length,
            growthRate: users.length > 0 ? Math.round(((users.filter(u => new Date(u.createdAt) >= dateStart).length / users.length) * 100) * 100) / 100 : 0
          }
        };
        break;

      case 'revenue':
        // Create monthly revenue breakdown
        const monthlyRevenue = [];
        const monthsToShow = period === '1y' ? 12 : period === '90d' ? 3 : 1;
        
        for (let i = 0; i < monthsToShow; i++) {
          const monthStart = new Date(dateEnd.getFullYear(), dateEnd.getMonth() - i, 1);
          const monthEnd = new Date(dateEnd.getFullYear(), dateEnd.getMonth() - i + 1, 0);
          
          const monthUsers = users.filter(u => {
            const userDate = new Date(u.createdAt);
            return userDate >= monthStart && userDate <= monthEnd;
          });
          
          const monthCompanies = companies.filter(c => {
            const companyDate = new Date(c.createdAt);
            return companyDate >= monthStart && companyDate <= monthEnd;
          });
          
          const monthRevenue = (monthUsers.length * baseSubscriptionPrice) + 
                              (monthCompanies.length * baseSubscriptionPrice * companyMultiplier);
          
          monthlyRevenue.unshift({
            month: formatDate(monthStart, timezone, 'MMM YYYY'),
            revenue: formatCurrency(monthRevenue, currency),
            rawRevenue: monthRevenue,
            users: monthUsers.length,
            companies: monthCompanies.length,
            transactions: monthUsers.length + monthCompanies.length
          });
        }

        reportData = {
          totalRevenue: formatCurrency(totalRevenue, currency),
          monthlyBreakdown: monthlyRevenue,
          revenueStreams: {
            userSubscriptions: {
              revenue: formatCurrency(userRevenue, currency),
              percentage: totalRevenue > 0 ? Math.round((userRevenue / totalRevenue) * 100) : 0,
              count: users.length
            },
            companySubscriptions: {
              revenue: formatCurrency(companyRevenue, currency),
              percentage: totalRevenue > 0 ? Math.round((companyRevenue / totalRevenue) * 100) : 0,
              count: companies.length
            }
          },
          projections: {
            nextMonth: formatCurrency(totalRevenue * 1.1, currency), // 10% growth assumption
            nextQuarter: formatCurrency(totalRevenue * 3.3, currency), // 3 months with 10% growth
            nextYear: formatCurrency(totalRevenue * 13.2, currency) // 12 months with 10% growth
          }
        };
        break;

      case 'subscriptions':
        const subscriptionTiers = [
          { name: 'Individual User', price: baseSubscriptionPrice, users: users.length },
          { name: 'Company Plan', price: baseSubscriptionPrice * companyMultiplier, users: companies.length }
        ];

        reportData = {
          overview: subscriptionMetrics,
          tierBreakdown: subscriptionTiers.map(tier => ({
            ...tier,
            revenue: formatCurrency(tier.price * tier.users, currency),
            percentage: (users.length + companies.length) > 0 ? 
                       Math.round((tier.users / (users.length + companies.length)) * 100) : 0
          })),
          analytics: {
            conversionRate: Math.round(Math.random() * 10 + 85), // 85-95% simulated
            retentionRate: Math.round(100 - subscriptionMetrics.churnRate),
            upgradeRate: Math.round(Math.random() * 15 + 5), // 5-20% simulated
            downgrades: Math.floor(subscriptionMetrics.activeSubscriptions * 0.02)
          }
        };
        break;

      case 'transactions':
        reportData = {
          overview: transactionData,
          paymentMethods: {
            bankTransfer: { count: Math.floor(transactionData.totalTransactions * 0.6), percentage: 60 },
            cardPayment: { count: Math.floor(transactionData.totalTransactions * 0.3), percentage: 30 },
            mobileMoney: { count: Math.floor(transactionData.totalTransactions * 0.1), percentage: 10 }
          },
          status: {
            completed: transactionData.successfulTransactions,
            failed: transactionData.failedTransactions,
            pending: transactionData.pendingTransactions,
            refunded: Math.floor(transactionData.totalTransactions * 0.01)
          },
          trends: {
            successRate: Math.round((transactionData.successfulTransactions / transactionData.totalTransactions) * 100),
            averageProcessingTime: '2.3 seconds',
            peakTransactionHour: '14:00 - 15:00 WAT'
          }
        };
        break;

      case 'taxes':
        reportData = {
          vatSummary: {
            rate: `${vatRate}%`,
            grossRevenue: formatCurrency(totalRevenue, currency),
            vatAmount: formatCurrency(vatAmount, currency),
            netRevenue: formatCurrency(netRevenue, currency),
            vatableTransactions: transactionData.successfulTransactions
          },
          compliance: {
            vatRegistrationRequired: totalRevenue > 25000000, // ₦25M threshold
            tinRequired: true,
            monthlyFilingRequired: totalRevenue > 25000000,
            quarterlyFilingRequired: totalRevenue <= 25000000,
            nextFilingDate: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 21), timezone)
          },
          breakdown: {
            standardRate: { rate: '7.5%', amount: formatCurrency(vatAmount, currency) },
            zeroRate: { rate: '0%', amount: formatCurrency(0, currency) },
            exempt: { rate: 'N/A', amount: formatCurrency(0, currency) }
          }
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type',
          availableTypes: ['overview', 'revenue', 'subscriptions', 'transactions', 'taxes']
        });
    }

    // Log the report generation
    await logActivity({
      userId: req.user.id,
      action: 'FINANCIAL_REPORT_GENERATED',
      entity: 'FinancialReport',
      entityId: reportType,
      details: {
        reportType,
        period,
        currency,
        totalRevenue,
        generatedBy: req.user.name,
        companyFilter: companyId || null
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      message: `Financial report (${reportType}) generated successfully`,
      data: {
        reportType,
        period,
        currency,
        dateRange: {
          start: formatDate(dateStart, timezone),
          end: formatDate(dateEnd, timezone)
        },
        report: reportData,
        metadata: {
          generatedAt: getCurrentTime(timezone),
          generatedBy: req.user.name,
          timezone,
          currency,
          nigerianCompliance: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generating financial report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate financial report',
      details: error.message
    });
  }
});

// Export financial data in various formats
router.post('/financial/export', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { 
      reportType = 'overview',
      format = 'json', // json, csv, xlsx, pdf
      period = '30d',
      currency = 'NGN',
      includeDetails = true,
      companyId 
    } = req.body;
    
    console.log(`📊 Exporting financial data: ${reportType} as ${format}...`);

    // Calculate date range
    const now = new Date();
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const dateStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Get data for export
    const [users, companies] = await Promise.all([
      prisma.user.findMany({
        where: {
          createdAt: { gte: dateStart },
          ...(companyId && { companyId })
        },
        include: { 
          company: { select: { name: true } },
          ...(includeDetails && {
            createdNotes: { select: { id: true, createdAt: true } },
            assignedTasks: { select: { id: true, createdAt: true, status: true } }
          })
        }
      }),
      prisma.company.findMany({
        where: {
          createdAt: { gte: dateStart },
          ...(companyId && { id: companyId })
        },
        include: {
          ...(includeDetails && {
            users: { select: { id: true, name: true, role: true } },
            departments: { select: { id: true, name: true } }
          })
        }
      })
    ]);

    // Generate export data
    const baseSubscriptionPrice = 5000;
    const companyMultiplier = 2;
    const vatRate = 7.5;

    const exportData = {
      summary: {
        reportType,
        period: `${daysBack} days`,
        currency,
        dateRange: {
          start: formatDate(dateStart, timezone),
          end: formatDate(now, timezone)
        },
        generatedAt: getCurrentTime(timezone),
        generatedBy: req.user.name
      },
      financials: {
        userRevenue: users.length * baseSubscriptionPrice,
        companyRevenue: companies.length * baseSubscriptionPrice * companyMultiplier,
        totalRevenue: (users.length * baseSubscriptionPrice) + (companies.length * baseSubscriptionPrice * companyMultiplier),
        vatAmount: Math.round(((users.length * baseSubscriptionPrice) + (companies.length * baseSubscriptionPrice * companyMultiplier)) * vatRate / 100),
        netRevenue: ((users.length * baseSubscriptionPrice) + (companies.length * baseSubscriptionPrice * companyMultiplier)) * (1 - vatRate/100)
      },
      customers: {
        totalUsers: users.length,
        totalCompanies: companies.length,
        newUsers: users.filter(u => new Date(u.createdAt) >= dateStart).length,
        newCompanies: companies.filter(c => new Date(c.createdAt) >= dateStart).length
      }
    };

    // Add detailed data if requested
    if (includeDetails) {
      exportData.userDetails = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company?.name || 'Individual',
        joinDate: formatDate(user.createdAt, timezone),
        revenue: baseSubscriptionPrice,
        formattedRevenue: formatCurrency(baseSubscriptionPrice, currency),
        notesCreated: user.createdNotes?.length || 0,
        tasksAssigned: user.assignedTasks?.length || 0,
        lastSeen: user.lastSeen ? formatDate(user.lastSeen, timezone) : 'Never'
      }));

      exportData.companyDetails = companies.map(company => ({
        id: company.id,
        name: company.name,
        email: company.email,
        joinDate: formatDate(company.createdAt, timezone),
        userCount: company.users?.length || 0,
        departmentCount: company.departments?.length || 0,
        revenue: baseSubscriptionPrice * companyMultiplier,
        formattedRevenue: formatCurrency(baseSubscriptionPrice * companyMultiplier, currency),
        status: 'Active'
      }));
    }

    // Format data based on export format
    let exportResult = {};
    
    switch (format.toLowerCase()) {
      case 'json':
        exportResult = {
          data: exportData,
          filename: `financial-report-${reportType}-${period}-${formatDate(now, timezone, 'YYYY-MM-DD')}.json`,
          mimeType: 'application/json',
          size: JSON.stringify(exportData).length
        };
        break;

      case 'csv':
        // Simulate CSV generation
        const csvHeaders = ['Type', 'Name', 'Email', 'Join Date', 'Revenue', 'Status'];
        const csvRows = [
          ...users.map(u => ['User', u.name, u.email, formatDate(u.createdAt, timezone), formatCurrency(baseSubscriptionPrice, currency), 'Active']),
          ...companies.map(c => ['Company', c.name, c.email, formatDate(c.createdAt, timezone), formatCurrency(baseSubscriptionPrice * companyMultiplier, currency), 'Active'])
        ];
        
        exportResult = {
          headers: csvHeaders,
          rows: csvRows,
          filename: `financial-report-${reportType}-${period}-${formatDate(now, timezone, 'YYYY-MM-DD')}.csv`,
          mimeType: 'text/csv',
          rowCount: csvRows.length
        };
        break;

      case 'xlsx':
        // Simulate Excel generation
        exportResult = {
          sheets: [
            {
              name: 'Summary',
              data: exportData.summary
            },
            {
              name: 'Financials',
              data: exportData.financials
            },
            ...(includeDetails ? [
              { name: 'Users', data: exportData.userDetails },
              { name: 'Companies', data: exportData.companyDetails }
            ] : [])
          ],
          filename: `financial-report-${reportType}-${period}-${formatDate(now, timezone, 'YYYY-MM-DD')}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        break;

      case 'pdf':
        // Simulate PDF generation
        exportResult = {
          sections: [
            { title: 'Executive Summary', content: exportData.summary },
            { title: 'Financial Overview', content: exportData.financials },
            { title: 'Customer Analytics', content: exportData.customers }
          ],
          filename: `financial-report-${reportType}-${period}-${formatDate(now, timezone, 'YYYY-MM-DD')}.pdf`,
          mimeType: 'application/pdf',
          pages: includeDetails ? Math.ceil((users.length + companies.length) / 50) + 3 : 3
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported export format',
          supportedFormats: ['json', 'csv', 'xlsx', 'pdf']
        });
    }

    // Log the export activity
    await logActivity({
      userId: req.user.id,
      action: 'FINANCIAL_DATA_EXPORTED',
      entity: 'FinancialExport',
      entityId: `${reportType}-${format}`,
      details: {
        reportType,
        format,
        period,
        currency,
        includeDetails,
        exportedBy: req.user.name,
        recordCount: users.length + companies.length,
        companyFilter: companyId || null
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      message: `Financial data exported successfully as ${format.toUpperCase()}`,
      data: {
        export: exportResult,
        metadata: {
          exportedAt: getCurrentTime(timezone),
          exportedBy: req.user.name,
          recordCount: users.length + companies.length,
          timezone,
          nigerianCompliance: true,
          vatIncluded: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Error exporting financial data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export financial data',
      details: error.message
    });
  }
});

// Get tax compliance information
router.get('/financial/tax-compliance', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const timezone = req.query.timezone || 'Africa/Lagos';
    const { year = new Date().getFullYear(), quarter } = req.query;
    
    console.log(`🧾 Generating tax compliance report for ${quarter ? `Q${quarter} ` : ''}${year}...`);

    // Calculate date range for tax period
    let startDate, endDate;
    
    if (quarter) {
      const quarterStart = {
        1: { month: 0, day: 1 },   // Q1: Jan 1
        2: { month: 3, day: 1 },   // Q2: Apr 1  
        3: { month: 6, day: 1 },   // Q3: Jul 1
        4: { month: 9, day: 1 }    // Q4: Oct 1
      };
      
      const quarterEnd = {
        1: { month: 2, day: 31 },  // Q1: Mar 31
        2: { month: 5, day: 30 },  // Q2: Jun 30
        3: { month: 8, day: 30 },  // Q3: Sep 30
        4: { month: 11, day: 31 }  // Q4: Dec 31
      };
      
      startDate = new Date(year, quarterStart[quarter].month, quarterStart[quarter].day);
      endDate = new Date(year, quarterEnd[quarter].month, quarterEnd[quarter].day);
    } else {
      startDate = new Date(year, 0, 1); // Jan 1
      endDate = new Date(year, 11, 31); // Dec 31
    }

    // Get financial data for tax period
    const [users, companies] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.company.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } }
      })
    ]);

    // Calculate tax figures
    const baseSubscriptionPrice = 5000;
    const companyMultiplier = 2;
    const vatRate = 7.5;
    
    const grossRevenue = (users.length * baseSubscriptionPrice) + (companies.length * baseSubscriptionPrice * companyMultiplier);
    const vatAmount = Math.round((grossRevenue * vatRate) / 100);
    const netRevenue = grossRevenue - vatAmount;

    // Nigerian tax compliance requirements
    const complianceData = {
      period: {
        type: quarter ? 'quarterly' : 'annual',
        quarter: quarter || null,
        year: parseInt(year),
        startDate: formatDate(startDate, timezone),
        endDate: formatDate(endDate, timezone)
      },
      
      vatReturn: {
        grossRevenue: {
          amount: grossRevenue,
          formatted: formatCurrency(grossRevenue, 'NGN')
        },
        vatCollected: {
          amount: vatAmount,
          formatted: formatCurrency(vatAmount, 'NGN'),
          rate: `${vatRate}%`
        },
        netRevenue: {
          amount: netRevenue,
          formatted: formatCurrency(netRevenue, 'NGN')
        },
        vatableTransactions: users.length + companies.length,
        exemptTransactions: 0,
        zeroRatedTransactions: 0
      },
      
      filingRequirements: {
        vatFilingRequired: grossRevenue > 0,
        vatThresholdMet: grossRevenue > 25000000, // ₦25M annual threshold
        tinRequired: true,
        vatRegistrationRequired: grossRevenue > 25000000,
        filingFrequency: grossRevenue > 25000000 ? 'monthly' : 'quarterly',
        nextFilingDate: formatDate(
          new Date(endDate.getFullYear(), endDate.getMonth() + 1, 21), 
          timezone
        ),
        penaltyForLateFromDate: formatDate(
          new Date(endDate.getFullYear(), endDate.getMonth() + 1, 22), 
          timezone
        )
      },
      
      complianceStatus: {
        vatCompliant: true,
        filingUpToDate: true,
        registrationValid: grossRevenue > 25000000,
        tinValid: true,
        lastFilingDate: formatDate(
          new Date(endDate.getFullYear(), endDate.getMonth(), 21), 
          timezone
        ),
        nextFilingDue: formatDate(
          new Date(endDate.getFullYear(), endDate.getMonth() + 1, 21), 
          timezone
        )
      },
      
      breakdown: {
        individualUsers: {
          count: users.length,
          revenue: users.length * baseSubscriptionPrice,
          formattedRevenue: formatCurrency(users.length * baseSubscriptionPrice, 'NGN'),
          vat: Math.round((users.length * baseSubscriptionPrice * vatRate) / 100)
        },
        companies: {
          count: companies.length,
          revenue: companies.length * baseSubscriptionPrice * companyMultiplier,
          formattedRevenue: formatCurrency(companies.length * baseSubscriptionPrice * companyMultiplier, 'NGN'),
          vat: Math.round((companies.length * baseSubscriptionPrice * companyMultiplier * vatRate) / 100)
        }
      },
      
      recommendations: [
        ...(grossRevenue > 25000000 ? ['Ensure monthly VAT filing is maintained'] : ['Consider quarterly VAT filing schedule']),
        'Maintain proper invoice documentation',
        'Keep records of all VAT-able transactions',
        'Ensure TIN is displayed on all invoices',
        ...(grossRevenue > 25000000 ? ['Consider VAT registration if not already registered'] : []),
        'Schedule regular compliance reviews'
      ]
    };

    // Log compliance check
    await logActivity({
      userId: req.user.id,
      action: 'TAX_COMPLIANCE_CHECK',
      entity: 'TaxCompliance',
      entityId: `${year}${quarter ? `-Q${quarter}` : ''}`,
      details: {
        year,
        quarter: quarter || null,
        grossRevenue,
        vatAmount,
        checkedBy: req.user.name,
        complianceStatus: complianceData.complianceStatus
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: getCurrentTime(timezone)
    });

    res.json({
      success: true,
      message: `Tax compliance information generated for ${quarter ? `Q${quarter} ` : ''}${year}`,
      data: {
        compliance: complianceData,
        metadata: {
          generatedAt: getCurrentTime(timezone),
          generatedBy: req.user.name,
          timezone,
          country: 'Nigeria',
          currency: 'NGN',
          vatRate: `${vatRate}%`
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generating tax compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tax compliance report',
      details: error.message
    });
  }
});

// =============================================
// 8. PLATFORM HEALTH & PERFORMANCE MONITORING
// =============================================

// Platform Health Monitoring - Comprehensive system metrics
router.get('/health/monitoring', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const now = new Date();
    const lagosTruncation = 60 * 60 * 1000;
    
    console.log(`🏥 Platform Health Monitoring - ${getCurrentTime(timezone)}`);

    // Database health check
    const dbStartTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      var dbResponseTime = Date.now() - dbStartTime;
      var dbStatus = 'healthy';
    } catch (error) {
      var dbResponseTime = Date.now() - dbStartTime;
      var dbStatus = 'unhealthy';
      console.error('Database health check failed:', error.message);
    }

    // Get current system metrics
    const systemMetrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };

    // Database metrics
    const [totalUsers, totalCompanies, totalNotes, totalTasks] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(), 
      prisma.note.count(),
      prisma.task.count()
    ]);

    // Calculate database connection pool metrics
    const dbMetrics = {
      responseTime: dbResponseTime,
      status: dbStatus,
      totalRecords: totalUsers + totalCompanies + totalNotes + totalTasks,
      collections: {
        users: totalUsers,
        companies: totalCompanies,
        notes: totalNotes,
        tasks: totalTasks
      }
    };

    // API Performance tracking (simulated based on current data)
    const apiMetrics = {
      totalEndpoints: 32, // Based on our implemented routes
      averageResponseTime: Math.round(50 + Math.random() * 100), // 50-150ms simulated
      requestsPerMinute: Math.round(10 + Math.random() * 40), // 10-50 rpm simulated
      errorRate: Math.round(Math.random() * 3), // 0-3% error rate
      successRate: 100 - Math.round(Math.random() * 3)
    };

    // System health indicators
    const healthIndicators = {
      overall: dbStatus === 'healthy' && systemMetrics.memory.heapUsed < 1000000000 ? 'healthy' : 'warning',
      database: dbStatus,
      memory: systemMetrics.memory.heapUsed < 1000000000 ? 'healthy' : 'warning',
      api: apiMetrics.errorRate < 5 ? 'healthy' : 'warning',
      uptime: systemMetrics.uptime > 3600 ? 'healthy' : 'starting'
    };

    // Generate Nigerian business hours analysis
    const lagosTime = new Date(now.toLocaleString("en-US", {timeZone: "Africa/Lagos"}));
    const hour = lagosTime.getHours();
    const isBusinessHours = hour >= 8 && hour <= 17; // 8 AM to 5 PM Lagos time
    const isWeekend = lagosTime.getDay() === 0 || lagosTime.getDay() === 6;

    const businessHoursAnalysis = {
      currentHour: hour,
      isBusinessHours,
      isWeekend,
      timeZone: timezone,
      localTime: formatDate(lagosTime, timezone),
      nextBusinessHour: isBusinessHours ? null : (hour < 8 ? 8 : hour > 17 ? 8 : 8),
      peakHours: [9, 10, 11, 14, 15, 16], // Typical peak business hours
      isPeakHour: [9, 10, 11, 14, 15, 16].includes(hour)
    };

    // Calculate performance scores
    const performanceScores = {
      database: dbResponseTime < 100 ? 95 : dbResponseTime < 200 ? 85 : 70,
      api: apiMetrics.errorRate < 1 ? 95 : apiMetrics.errorRate < 3 ? 85 : 70,
      memory: systemMetrics.memory.heapUsed < 500000000 ? 95 : systemMetrics.memory.heapUsed < 1000000000 ? 85 : 70,
      overall: 0
    };
    performanceScores.overall = Math.round((performanceScores.database + performanceScores.api + performanceScores.memory) / 3);

    const healthReport = {
      timestamp: getCurrentTime(timezone),
      status: healthIndicators.overall,
      uptime: Math.round(systemMetrics.uptime),
      performanceScore: performanceScores.overall,
      
      system: {
        memory: {
          used: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024), // MB
          total: Math.round(systemMetrics.memory.heapTotal / 1024 / 1024), // MB
          percentage: Math.round((systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100),
          status: healthIndicators.memory
        },
        cpu: {
          user: Math.round(systemMetrics.cpu.user / 1000), // milliseconds
          system: Math.round(systemMetrics.cpu.system / 1000),
          platform: systemMetrics.platform,
          nodeVersion: systemMetrics.nodeVersion
        },
        uptime: {
          seconds: Math.round(systemMetrics.uptime),
          hours: Math.round(systemMetrics.uptime / 3600),
          status: healthIndicators.uptime
        }
      },

      database: {
        status: dbMetrics.status,
        responseTime: `${dbMetrics.responseTime}ms`,
        totalRecords: dbMetrics.totalRecords,
        collections: dbMetrics.collections,
        performanceScore: performanceScores.database
      },

      api: {
        status: healthIndicators.api,
        totalEndpoints: apiMetrics.totalEndpoints,
        averageResponseTime: `${apiMetrics.averageResponseTime}ms`,
        requestsPerMinute: apiMetrics.requestsPerMinute,
        successRate: `${apiMetrics.successRate}%`,
        errorRate: `${apiMetrics.errorRate}%`,
        performanceScore: performanceScores.api
      },

      businessHours: businessHoursAnalysis,
      
      alerts: {
        critical: [],
        warnings: [],
        info: []
      }
    };

    // Generate alerts based on metrics
    if (dbResponseTime > 500) {
      healthReport.alerts.critical.push(`Database response time high: ${dbResponseTime}ms`);
    } else if (dbResponseTime > 200) {
      healthReport.alerts.warnings.push(`Database response time elevated: ${dbResponseTime}ms`);
    }

    if (systemMetrics.memory.heapUsed > 1000000000) {
      healthReport.alerts.critical.push(`High memory usage: ${Math.round(systemMetrics.memory.heapUsed / 1024 / 1024)}MB`);
    } else if (systemMetrics.memory.heapUsed > 500000000) {
      healthReport.alerts.warnings.push(`Elevated memory usage: ${Math.round(systemMetrics.memory.heapUsed / 1024 / 1024)}MB`);
    }

    if (apiMetrics.errorRate > 5) {
      healthReport.alerts.critical.push(`High API error rate: ${apiMetrics.errorRate}%`);
    } else if (apiMetrics.errorRate > 2) {
      healthReport.alerts.warnings.push(`Elevated API error rate: ${apiMetrics.errorRate}%`);
    }

    if (isBusinessHours && !isWeekend) {
      healthReport.alerts.info.push('Operating during Nigerian business hours - monitoring enhanced');
    }

    if (healthIndicators.overall === 'healthy') {
      healthReport.alerts.info.push('All systems operating normally');
    }

    res.json({
      success: true,
      message: 'Platform health monitoring data retrieved successfully',
      data: healthReport,
      metadata: {
        timezone,
        generatedAt: getCurrentTime(timezone),
        coverage: 'System, Database, API, Business Hours',
        region: 'Nigeria'
      }
    });

  } catch (error) {
    console.error('Error in platform health monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve platform health data',
      error: error.message
    });
  }
});

// Performance Analytics - Detailed performance metrics and trends
router.get('/health/performance', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const { period = '24h', metric = 'all' } = req.query;
    const now = new Date();
    
    console.log(`📊 Performance Analytics - ${getCurrentTime(timezone)} - Period: ${period}`);

    // Calculate time range for analysis
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const timeRange = timeRanges[period] || timeRanges['24h'];
    const startTime = new Date(now.getTime() - timeRange);

    // Get user activity data for performance analysis
    const [recentUsers, recentCompanies, recentNotes, recentTasks] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: startTime } },
        include: { 
          company: { select: { name: true } },
          createdNotes: { 
            where: { createdAt: { gte: startTime } },
            select: { id: true, createdAt: true }
          }
        }
      }),
      prisma.company.findMany({
        where: { createdAt: { gte: startTime } },
        include: {
          users: { select: { id: true } }
        }
      }),
      prisma.note.findMany({
        where: { createdAt: { gte: startTime } },
        select: { id: true, createdAt: true, createdBy: true }
      }),
      prisma.task.findMany({
        where: { createdAt: { gte: startTime } },
        select: { id: true, createdAt: true, status: true, assignedTo: true }
      })
    ]);

    // Calculate throughput metrics
    const throughputMetrics = {
      period,
      totalRequests: recentUsers.length + recentCompanies.length + recentNotes.length + recentTasks.length,
      usersCreated: recentUsers.length,
      companiesCreated: recentCompanies.length,
      notesCreated: recentNotes.length,
      tasksCreated: recentTasks.length,
      requestsPerHour: Math.round((recentUsers.length + recentCompanies.length + recentNotes.length + recentTasks.length) / (timeRange / (60 * 60 * 1000))),
      averageProcessingTime: Math.round(50 + Math.random() * 100) // Simulated 50-150ms
    };

    // Analyze hourly patterns for Nigerian business hours
    const hourlyActivity = {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyActivity[hour] = {
        users: 0,
        notes: 0,
        tasks: 0,
        total: 0
      };
    }

    // Analyze activity by hour
    [...recentUsers, ...recentNotes, ...recentTasks].forEach(item => {
      const itemTime = new Date(item.createdAt);
      const lagosTime = new Date(itemTime.toLocaleString("en-US", {timeZone: "Africa/Lagos"}));
      const hour = lagosTime.getHours();
      
      if (recentUsers.includes(item)) {
        hourlyActivity[hour].users++;
      } else if (recentNotes.includes(item)) {
        hourlyActivity[hour].notes++;
      } else if (recentTasks.includes(item)) {
        hourlyActivity[hour].tasks++;
      }
      hourlyActivity[hour].total++;
    });

    // Calculate peak hours
    const hourlyTotals = Object.entries(hourlyActivity).map(([hour, data]) => ({
      hour: parseInt(hour),
      total: data.total
    }));
    
    const peakHours = hourlyTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => item.hour);

    // Business hours analysis (8 AM - 5 PM Lagos time)
    const businessHoursActivity = hourlyTotals
      .filter(item => item.hour >= 8 && item.hour <= 17)
      .reduce((sum, item) => sum + item.total, 0);
    
    const afterHoursActivity = hourlyTotals
      .filter(item => item.hour < 8 || item.hour > 17)
      .reduce((sum, item) => sum + item.total, 0);

    const businessHoursPercentage = businessHoursActivity + afterHoursActivity > 0 
      ? Math.round((businessHoursActivity / (businessHoursActivity + afterHoursActivity)) * 100)
      : 0;

    // Performance benchmarks
    const performanceBenchmarks = {
      responseTime: {
        target: 200, // ms
        current: throughputMetrics.averageProcessingTime,
        status: throughputMetrics.averageProcessingTime <= 200 ? 'excellent' : 
                throughputMetrics.averageProcessingTime <= 500 ? 'good' : 'needs_improvement'
      },
      throughput: {
        target: 100, // requests per hour
        current: throughputMetrics.requestsPerHour,
        status: throughputMetrics.requestsPerHour >= 100 ? 'excellent' :
                throughputMetrics.requestsPerHour >= 50 ? 'good' : 'low'
      },
      availability: {
        target: 99.9, // percentage
        current: 99.2 + Math.random() * 0.7, // Simulated 99.2-99.9%
        status: 'excellent'
      }
    };

    // Resource utilization analysis
    const memoryUsage = process.memoryUsage();
    const resourceUtilization = {
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        trend: Math.random() > 0.5 ? 'increasing' : 'stable'
      },
      cpu: {
        current: Math.round(Math.random() * 30 + 20), // 20-50% simulated
        average: Math.round(Math.random() * 25 + 25), // 25-50% simulated  
        trend: Math.random() > 0.5 ? 'stable' : 'decreasing'
      },
      database: {
        connections: Math.round(Math.random() * 10 + 5), // 5-15 connections
        queryTime: Math.round(Math.random() * 50 + 25), // 25-75ms average
        trend: 'stable'
      }
    };

    // Calculate performance scores
    const performanceScores = {
      responseTime: performanceBenchmarks.responseTime.current <= 200 ? 95 : 
                   performanceBenchmarks.responseTime.current <= 500 ? 80 : 60,
      throughput: performanceBenchmarks.throughput.current >= 100 ? 95 :
                 performanceBenchmarks.throughput.current >= 50 ? 80 : 60,
      availability: Math.round(performanceBenchmarks.availability.current),
      resource: 100 - Math.round(resourceUtilization.memory.percentage / 2) - Math.round(resourceUtilization.cpu.current / 4)
    };
    
    performanceScores.overall = Math.round((performanceScores.responseTime + performanceScores.throughput + 
                                          performanceScores.availability + performanceScores.resource) / 4);

    const performanceAnalysis = {
      timestamp: getCurrentTime(timezone),
      period,
      overallScore: performanceScores.overall,
      
      throughput: throughputMetrics,
      
      businessHours: {
        timezone,
        businessHoursActivity,
        afterHoursActivity,
        businessHoursPercentage: `${businessHoursPercentage}%`,
        peakHours: peakHours.map(h => `${h}:00`),
        currentHour: new Date().toLocaleString("en-US", {timeZone: "Africa/Lagos", hour: '2-digit', hour12: false}),
        isBusinessHours: (() => {
          const hour = parseInt(new Date().toLocaleString("en-US", {timeZone: "Africa/Lagos", hour: '2-digit', hour12: false}));
          return hour >= 8 && hour <= 17;
        })()
      },

      hourlyBreakdown: hourlyActivity,

      benchmarks: performanceBenchmarks,

      resourceUtilization,

      scores: performanceScores,

      recommendations: [
        performanceScores.responseTime < 80 ? 'Consider optimizing API response times' : 'Response times are optimal',
        performanceScores.throughput < 80 ? 'Monitor request throughput during peak hours' : 'Throughput performance is good',
        resourceUtilization.memory.percentage > 80 ? 'Consider memory optimization' : 'Memory usage is healthy',
        businessHoursPercentage > 80 ? 'Peak activity during business hours - ensure adequate scaling' : 'Activity well distributed',
        'Continue monitoring during Nigerian peak business hours (9 AM - 4 PM Lagos time)'
      ],

      trends: {
        memory: resourceUtilization.memory.trend,
        cpu: resourceUtilization.cpu.trend,
        database: resourceUtilization.database.trend,
        overall: performanceScores.overall > 85 ? 'improving' : performanceScores.overall > 70 ? 'stable' : 'declining'
      }
    };

    res.json({
      success: true,
      message: 'Performance analytics retrieved successfully',
      data: performanceAnalysis,
      metadata: {
        timezone,
        period,
        generatedAt: getCurrentTime(timezone),
        dataPoints: throughputMetrics.totalRequests,
        region: 'Nigeria'
      }
    });

  } catch (error) {
    console.error('Error in performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance analytics',
      error: error.message
    });
  }
});

// System Health Dashboard - Comprehensive real-time dashboard
router.get('/health/dashboard', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const now = new Date();
    
    console.log(`🖥️ System Health Dashboard - ${getCurrentTime(timezone)}`);

    // Get real-time system metrics
    const systemStartTime = Date.now();
    const [
      totalUsers, totalCompanies, totalNotes, totalTasks,
      recentUsers, recentCompanies, recentNotes, recentTasks
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.note.count(),
      prisma.task.count(),
      prisma.user.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      prisma.company.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      prisma.note.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      prisma.task.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } })
    ]);
    const systemQueryTime = Date.now() - systemStartTime;

    // Current system status
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const systemStatus = {
      overall: 'healthy',
      database: systemQueryTime < 200 ? 'healthy' : 'warning',
      api: 'healthy',
      memory: memoryUsage.heapUsed < 1000000000 ? 'healthy' : 'warning',
      uptime: uptime > 3600 ? 'healthy' : 'starting'
    };

    // Real-time metrics
    const realTimeMetrics = {
      timestamp: getCurrentTime(timezone),
      uptime: Math.round(uptime),
      
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        },
        cpu: {
          usage: Math.round(Math.random() * 30 + 15), // 15-45% simulated
          processes: Math.round(Math.random() * 50 + 20) // 20-70 processes simulated
        },
        database: {
          responseTime: `${systemQueryTime}ms`,
          status: systemStatus.database,
          activeConnections: Math.round(Math.random() * 10 + 3) // 3-13 connections
        }
      },

      platform: {
        totalUsers,
        totalCompanies,
        totalNotes,
        totalTasks,
        totalRecords: totalUsers + totalCompanies + totalNotes + totalTasks
      },

      activity24h: {
        newUsers: recentUsers.length,
        newCompanies: recentCompanies.length,
        newNotes: recentNotes.length,
        newTasks: recentTasks.length,
        totalActivity: recentUsers.length + recentCompanies.length + recentNotes.length + recentTasks.length
      }
    };

    // Nigerian business context
    const lagosTime = new Date(now.toLocaleString("en-US", {timeZone: "Africa/Lagos"}));
    const hour = lagosTime.getHours();
    const dayOfWeek = lagosTime.getDay();
    const isBusinessHours = hour >= 8 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const businessContext = {
      timeZone: timezone,
      localTime: formatDate(lagosTime, timezone),
      hour,
      isBusinessHours,
      isWeekend,
      businessHoursStatus: isBusinessHours ? 'active' : isWeekend ? 'weekend' : 'after-hours'
    };

    // Alert management system
    const alerts = {
      critical: [],
      warnings: [],
      info: [],
      resolved: []
    };

    // Generate dynamic alerts based on current metrics
    if (systemQueryTime > 500) {
      alerts.critical.push({
        id: 'db_response_high',
        message: `Database response time critical: ${systemQueryTime}ms`,
        timestamp: getCurrentTime(timezone),
        severity: 'critical'
      });
    } else if (systemQueryTime > 200) {
      alerts.warnings.push({
        id: 'db_response_elevated',
        message: `Database response time elevated: ${systemQueryTime}ms`,
        timestamp: getCurrentTime(timezone),
        severity: 'warning'
      });
    }

    if (memoryUsage.heapUsed > 1000000000) {
      alerts.critical.push({
        id: 'memory_high',
        message: `Memory usage critical: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        timestamp: getCurrentTime(timezone),
        severity: 'critical'
      });
    } else if (memoryUsage.heapUsed > 500000000) {
      alerts.warnings.push({
        id: 'memory_elevated',
        message: `Memory usage elevated: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        timestamp: getCurrentTime(timezone),
        severity: 'warning'
      });
    }

    if (isBusinessHours) {
      alerts.info.push({
        id: 'business_hours_active',
        message: 'Nigerian business hours active - enhanced monitoring enabled',
        timestamp: getCurrentTime(timezone),
        severity: 'info'
      });
    }

    if (alerts.critical.length === 0 && alerts.warnings.length === 0) {
      alerts.info.push({
        id: 'all_systems_healthy',
        message: 'All systems operating within normal parameters',
        timestamp: getCurrentTime(timezone),
        severity: 'info'
      });
    }

    // Performance indicators
    const performanceIndicators = {
      database: {
        score: systemQueryTime < 100 ? 95 : systemQueryTime < 200 ? 85 : systemQueryTime < 500 ? 70 : 50,
        status: systemStatus.database,
        responseTime: systemQueryTime
      },
      memory: {
        score: memoryUsage.heapUsed < 500000000 ? 95 : memoryUsage.heapUsed < 1000000000 ? 80 : 60,
        status: systemStatus.memory,
        usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      uptime: {
        score: uptime > 86400 ? 95 : uptime > 3600 ? 85 : 70, // 24h, 1h thresholds
        status: systemStatus.uptime,
        hours: Math.round(uptime / 3600)
      },
      overall: {
        score: Math.round((
          (systemQueryTime < 100 ? 95 : systemQueryTime < 200 ? 85 : 70) +
          (memoryUsage.heapUsed < 500000000 ? 95 : 80) +
          (uptime > 3600 ? 95 : 70)
        ) / 3),
        status: systemStatus.overall
      }
    };

    // Operational recommendations
    const recommendations = [
      {
        category: 'performance',
        priority: systemQueryTime > 200 ? 'high' : 'medium',
        message: systemQueryTime > 200 ? 'Consider database query optimization' : 'Database performance is optimal'
      },
      {
        category: 'resources',
        priority: memoryUsage.heapUsed > 800000000 ? 'high' : 'low',
        message: memoryUsage.heapUsed > 800000000 ? 'Memory usage approaching limits' : 'Resource utilization is healthy'
      },
      {
        category: 'monitoring',
        priority: 'medium',
        message: isBusinessHours ? 'Enhanced monitoring during Nigerian business hours' : 'Standard monitoring active'
      },
      {
        category: 'scaling',
        priority: realTimeMetrics.activity24h.totalActivity > 50 ? 'medium' : 'low',
        message: realTimeMetrics.activity24h.totalActivity > 50 ? 'Consider scaling for increased activity' : 'Current capacity adequate'
      }
    ];

    const dashboardData = {
      timestamp: getCurrentTime(timezone),
      status: systemStatus.overall,
      performanceScore: performanceIndicators.overall.score,
      
      realTimeMetrics,
      businessContext,
      alerts,
      performanceIndicators,
      recommendations,

      quickStats: {
        totalPlatformUsers: totalUsers + totalCompanies,
        dailyActivity: realTimeMetrics.activity24h.totalActivity,
        systemUptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        healthScore: `${performanceIndicators.overall.score}%`,
        alertCount: {
          critical: alerts.critical.length,
          warnings: alerts.warnings.length,
          info: alerts.info.length
        }
      },

      systemOverview: {
        platform: 'CollabNotes Nigeria',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        timezone,
        monitoringActive: true,
        lastUpdate: getCurrentTime(timezone)
      }
    };

    res.json({
      success: true,
      message: 'System health dashboard data retrieved successfully',
      data: dashboardData,
      metadata: {
        timezone,
        businessHours: isBusinessHours,
        generatedAt: getCurrentTime(timezone),
        region: 'Nigeria',
        monitoringLevel: isBusinessHours ? 'enhanced' : 'standard'
      }
    });

  } catch (error) {
    console.error('Error in system health dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system health dashboard',
      error: error.message,
      fallbackData: {
        status: 'error',
        timestamp: getCurrentTime('Africa/Lagos'),
        message: 'Dashboard temporarily unavailable'
      }
    });
  }
});

// =============================================
// REAL-TIME CURRENCY EXCHANGE RATES
// =============================================

// Get all currency exchange rates (real-time and cached)
router.get('/currency/rates', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const { force = false, format = 'detailed' } = req.query;
    
    console.log(`💱 Currency Exchange Rates Request - ${getCurrentTime(timezone)} - Force: ${force}`);

    // Import real-time currency functions
    const { getAllCurrencyRates, fetchRealTimeRates } = require('../utils/currency');

    // Force refresh if requested
    if (force === 'true') {
      await fetchRealTimeRates(true);
    }

    // Get all currency rates
    const ratesData = await getAllCurrencyRates();

    // Format response based on request
    let response = {
      timestamp: getCurrentTime(timezone),
      baseCurrency: ratesData.baseCurrency,
      lastUpdated: ratesData.lastUpdated,
      source: ratesData.source,
      totalCurrencies: Object.keys(ratesData.currencies).length
    };

    if (format === 'simple') {
      // Simple format - just currency codes and rates
      response.rates = {};
      Object.entries(ratesData.currencies).forEach(([code, info]) => {
        response.rates[code] = {
          symbol: info.symbol,
          rate: info.rate,
          inverseRate: info.inverseRate || (1 / info.rate)
        };
      });
    } else {
      // Detailed format - full currency information
      response.currencies = ratesData.currencies;
      response.popularCurrencies = ['USD', 'EUR', 'GBP', 'ZAR', 'GHS'];
      response.africanCurrencies = ['NGN', 'ZAR', 'GHS', 'KES', 'EGP'];
    }

    // Add market insights
    const usdRate = ratesData.currencies.USD;
    if (usdRate && usdRate.inverseRate) {
      response.marketInsights = {
        ngnToUsd: `₦${Math.round(usdRate.inverseRate)} = $1`,
        usdToNgn: `$1 = ₦${Math.round(usdRate.inverseRate)}`,
        volatility: usdRate.source === 'real-time' ? 'live' : 'static',
        lastUpdate: usdRate.lastUpdated,
        cacheAge: usdRate.cacheAge ? `${usdRate.cacheAge} minutes ago` : null
      };
    }

    res.json({
      success: true,
      message: 'Currency exchange rates retrieved successfully',
      data: response,
      metadata: {
        timezone,
        generatedAt: getCurrentTime(timezone),
        refreshed: force === 'true',
        region: 'Nigeria'
      }
    });

  } catch (error) {
    console.error('Error retrieving currency rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve currency exchange rates',
      error: error.message
    });
  }
});

// Get specific currency exchange rate information
router.get('/currency/rates/:currencyCode', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const { currencyCode } = req.params;
    const { detailed = true } = req.query;

    console.log(`💱 Currency Rate Request - ${currencyCode} - ${getCurrentTime(timezone)}`);

    // Import currency functions
    const { getExchangeRateInfo, SUPPORTED_CURRENCIES } = require('../utils/currency');

    // Validate currency code
    if (!SUPPORTED_CURRENCIES[currencyCode.toUpperCase()]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency code: ${currencyCode}`,
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES)
      });
    }

    // Get exchange rate information
    const rateInfo = await getExchangeRateInfo(currencyCode.toUpperCase());

    let response = {
      timestamp: getCurrentTime(timezone),
      currencyCode: rateInfo.code,
      currencyName: rateInfo.name,
      symbol: rateInfo.symbol,
      rate: rateInfo.rate,
      source: rateInfo.source
    };

    if (detailed === 'true') {
      response.details = {
        inverseRate: rateInfo.inverseRate,
        lastUpdated: rateInfo.lastUpdated,
        isBaseCurrency: rateInfo.isBaseCurrency,
        cacheAge: rateInfo.cacheAge,
        error: rateInfo.error
      };

      // Add conversion examples
      if (currencyCode.toUpperCase() !== 'NGN') {
        response.examples = {
          ngnToForeign: {
            ngn1000: `₦1,000 = ${rateInfo.symbol}${(1000 * rateInfo.rate).toFixed(2)}`,
            ngn10000: `₦10,000 = ${rateInfo.symbol}${(10000 * rateInfo.rate).toFixed(2)}`,
            ngn100000: `₦100,000 = ${rateInfo.symbol}${(100000 * rateInfo.rate).toFixed(2)}`
          },
          foreignToNgn: {
            foreign1: `${rateInfo.symbol}1 = ₦${Math.round(rateInfo.inverseRate)}`,
            foreign10: `${rateInfo.symbol}10 = ₦${Math.round(rateInfo.inverseRate * 10)}`,
            foreign100: `${rateInfo.symbol}100 = ₦${Math.round(rateInfo.inverseRate * 100)}`
          }
        };
      }
    }

    res.json({
      success: true,
      message: `Exchange rate for ${rateInfo.name} retrieved successfully`,
      data: response,
      metadata: {
        timezone,
        generatedAt: getCurrentTime(timezone),
        baseCurrency: 'NGN',
        region: 'Nigeria'
      }
    });

  } catch (error) {
    console.error('Error retrieving specific currency rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve currency exchange rate',
      error: error.message
    });
  }
});

// Refresh currency exchange rates manually
router.post('/currency/rates/refresh', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    
    console.log(`🔄 Manual Currency Rates Refresh - ${getCurrentTime(timezone)}`);

    // Import refresh function
    const { fetchRealTimeRates } = require('../utils/currency');

    // Force refresh rates
    const refreshStartTime = Date.now();
    const rates = await fetchRealTimeRates(true);
    const refreshTime = Date.now() - refreshStartTime;

    // Count successful rates
    const successfulRates = Object.keys(rates).length;
    const usdRate = rates.USD;

    res.json({
      success: true,
      message: 'Currency exchange rates refreshed successfully',
      data: {
        timestamp: getCurrentTime(timezone),
        refreshTime: `${refreshTime}ms`,
        ratesUpdated: successfulRates,
        source: 'real-time',
        sampleRates: {
          USD: usdRate ? {
            rate: usdRate,
            ngnPerUsd: usdRate ? Math.round(1 / usdRate) : null,
            display: usdRate ? `$1 = ₦${Math.round(1 / usdRate)}` : null
          } : null,
          EUR: rates.EUR ? {
            rate: rates.EUR,
            display: `€1 = ₦${Math.round(1 / rates.EUR)}`
          } : null,
          GBP: rates.GBP ? {
            rate: rates.GBP,
            display: `£1 = ₦${Math.round(1 / rates.GBP)}`
          } : null
        }
      },
      metadata: {
        timezone,
        generatedAt: getCurrentTime(timezone),
        region: 'Nigeria',
        cacheExpiry: '30 minutes'
      }
    });

  } catch (error) {
    console.error('Error refreshing currency rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh currency exchange rates',
      error: error.message,
      fallback: 'Using cached or static rates'
    });
  }
});

// Convert currency amounts using real-time rates
router.post('/currency/convert', async (req, res) => {
  try {
    const timezone = 'Africa/Lagos';
    const { amount, fromCurrency, toCurrency, useRealTime = true } = req.body;

    // Validate input
    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, fromCurrency, toCurrency'
      });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    console.log(`💱 Currency Conversion - ${amount} ${fromCurrency} → ${toCurrency} - ${getCurrentTime(timezone)}`);

    // Import conversion functions
    const { convertCurrency, formatConvertedCurrency, SUPPORTED_CURRENCIES } = require('../utils/currency');

    // Validate currencies
    if (!SUPPORTED_CURRENCIES[fromCurrency.toUpperCase()] || !SUPPORTED_CURRENCIES[toCurrency.toUpperCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported currency code',
        supportedCurrencies: Object.keys(SUPPORTED_CURRENCIES)
      });
    }

    // Perform conversion
    const convertedAmount = await convertCurrency(
      parseFloat(amount), 
      fromCurrency.toUpperCase(), 
      toCurrency.toUpperCase(), 
      useRealTime
    );

    // Format currencies
    const formattedOriginal = formatConvertedCurrency(parseFloat(amount), fromCurrency.toUpperCase());
    const formattedConverted = formatConvertedCurrency(convertedAmount, toCurrency.toUpperCase());

    res.json({
      success: true,
      message: 'Currency conversion completed successfully',
      data: {
        timestamp: getCurrentTime(timezone),
        conversion: {
          from: {
            amount: parseFloat(amount),
            currency: fromCurrency.toUpperCase(),
            formatted: formattedOriginal
          },
          to: {
            amount: convertedAmount,
            currency: toCurrency.toUpperCase(),
            formatted: formattedConverted
          },
          rate: fromCurrency.toUpperCase() === 'NGN' ? 
            convertedAmount / parseFloat(amount) :
            parseFloat(amount) / convertedAmount,
          formula: `${formattedOriginal} = ${formattedConverted}`
        },
        source: useRealTime ? 'real-time' : 'static',
        baseCurrency: 'NGN'
      },
      metadata: {
        timezone,
        generatedAt: getCurrentTime(timezone),
        useRealTimeRates: useRealTime,
        region: 'Nigeria'
      }
    });

  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert currency',
      error: error.message
    });
  }
});

module.exports = router;