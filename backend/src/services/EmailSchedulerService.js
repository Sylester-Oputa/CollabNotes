// Email Scheduler Service for CollabNotes Nigeria
const cron = require('node-cron');
const EmailService = require('./emailService');
const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const prisma = new PrismaClient();

class EmailSchedulerService {
  constructor() {
    this.lagosTimezone = 'Africa/Lagos';
    this.isRunning = false;
    this.initScheduler();
  }

  /**
   * Initialize the email scheduler
   */
  initScheduler() {
    try {
      // Run every minute to check for scheduled emails
      cron.schedule('* * * * *', async () => {
        if (!this.isRunning) {
          this.isRunning = true;
          try {
            await this.processScheduledEmails();
          } catch (error) {
            console.error('Email scheduler error:', error);
          } finally {
            this.isRunning = false;
          }
        }
      });

      // Run cleanup tasks daily at 2:00 AM Lagos time
      cron.schedule('0 2 * * *', async () => {
        try {
          await this.cleanupOldEmailLogs();
          await this.generateDailyEmailReport();
        } catch (error) {
          console.error('Email cleanup error:', error);
        }
      }, {
        timezone: this.lagosTimezone
      });

      console.log('📧 Email scheduler initialized successfully');
    } catch (error) {
      console.error('Email scheduler initialization error:', error);
    }
  }

  /**
   * Process scheduled emails
   */
  async processScheduledEmails() {
    try {
      const result = await EmailService.processScheduledEmails();
      if (result > 0) {
        const lagosTime = format(
          toZonedTime(new Date(), this.lagosTimezone),
          'HH:mm dd/MM/yyyy'
        );
        console.log(`📧 [${lagosTime} WAT] Processed ${result} scheduled emails`);
      }
      return result;
    } catch (error) {
      console.error('Error processing scheduled emails:', error);
      throw error;
    }
  }

  /**
   * Schedule bulk emails for Nigerian business campaigns
   */
  async scheduleBulkEmails(campaignData) {
    try {
      const {
        templateId,
        recipients,
        sendTime,
        variables = {},
        campaignName,
        companyId,
        sentBy
      } = campaignData;

      const scheduledEmails = [];
      let batchDelay = 0; // Delay between batches to avoid overwhelming SMTP

      // Process in batches to respect rate limits
      const batchSize = 50;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        for (const recipient of batch) {
          try {
            // Calculate send time with small delays to spread load
            const scheduledFor = new Date(sendTime);
            scheduledFor.setSeconds(scheduledFor.getSeconds() + batchDelay);

            const emailData = {
              recipients: [recipient.email],
              variables: {
                ...variables,
                firstName: recipient.firstName,
                lastName: recipient.lastName,
                recipientEmail: recipient.email,
                ...recipient.customVariables
              },
              sentBy,
              scheduledFor: scheduledFor.toISOString()
            };

            const result = await EmailService.sendEmailFromTemplate(templateId, emailData);
            scheduledEmails.push({
              recipient: recipient.email,
              emailLogId: result.emailLogId,
              scheduledFor: scheduledFor
            });

            batchDelay += 2; // 2-second delay between emails
          } catch (error) {
            console.error(`Error scheduling email for ${recipient.email}:`, error);
          }
        }

        // Add longer delay between batches
        batchDelay += 30;
      }

      // Create campaign record
      const campaign = await prisma.emailCampaign.create({
        data: {
          name: campaignName,
          templateId,
          companyId,
          createdBy: sentBy,
          totalRecipients: recipients.length,
          scheduledEmails: scheduledEmails.length,
          status: 'SCHEDULED',
          sendTime: new Date(sendTime),
          metadata: {
            lagosTimezone: this.lagosTimezone,
            createdAtLagos: format(toZonedTime(new Date(), this.lagosTimezone), 'HH:mm dd/MM/yyyy')
          }
        }
      });

      console.log(`📧 Bulk email campaign scheduled: ${campaignName} (${scheduledEmails.length} emails)`);
      return {
        campaign,
        scheduledEmails: scheduledEmails.length,
        totalRecipients: recipients.length
      };

    } catch (error) {
      console.error('Error scheduling bulk emails:', error);
      throw error;
    }
  }

  /**
   * Get email delivery statistics
   */
  async getDeliveryStats(companyId, dateRange = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const stats = await prisma.emailLog.groupBy({
        by: ['status'],
        where: {
          companyId,
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      });

      const totalEmails = stats.reduce((sum, stat) => sum + stat._count.id, 0);
      
      const deliveryStats = {
        total: totalEmails,
        sent: 0,
        pending: 0,
        scheduled: 0,
        failed: 0,
        opened: 0
      };

      stats.forEach(stat => {
        deliveryStats[stat.status.toLowerCase()] = stat._count.id;
      });

      // Get opened emails count
      const openedCount = await prisma.emailLog.count({
        where: {
          companyId,
          createdAt: { gte: startDate },
          openedAt: { not: null }
        }
      });

      deliveryStats.opened = openedCount;

      // Calculate rates
      const deliveryRate = totalEmails > 0 ? ((deliveryStats.sent / totalEmails) * 100) : 0;
      const openRate = deliveryStats.sent > 0 ? ((deliveryStats.opened / deliveryStats.sent) * 100) : 0;
      const failureRate = totalEmails > 0 ? ((deliveryStats.failed / totalEmails) * 100) : 0;

      return {
        ...deliveryStats,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        openRate: parseFloat(openRate.toFixed(2)),
        failureRate: parseFloat(failureRate.toFixed(2)),
        dateRange,
        lagosTimezone: this.lagosTimezone
      };

    } catch (error) {
      console.error('Error getting delivery stats:', error);
      throw error;
    }
  }

  /**
   * Get email engagement analytics
   */
  async getEngagementAnalytics(companyId, dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Get daily email metrics
      const dailyMetrics = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_sent,
          COUNT(opened_at) as total_opened,
          AVG(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 100 as open_rate
        FROM email_logs 
        WHERE company_id = ${companyId} 
          AND created_at >= ${startDate}
          AND status = 'SENT'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;

      // Get top performing templates
      const topTemplates = await prisma.emailTemplate.findMany({
        where: {
          companyId,
          emailLogs: {
            some: {
              createdAt: { gte: startDate },
              status: 'SENT'
            }
          }
        },
        include: {
          _count: {
            select: {
              emailLogs: {
                where: {
                  createdAt: { gte: startDate },
                  status: 'SENT'
                }
              }
            }
          },
          emailLogs: {
            where: {
              createdAt: { gte: startDate },
              status: 'SENT',
              openedAt: { not: null }
            },
            select: { id: true }
          }
        },
        orderBy: {
          emailLogs: {
            _count: 'desc'
          }
        },
        take: 5
      });

      const templatesWithStats = topTemplates.map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        totalSent: template._count.emailLogs,
        totalOpened: template.emailLogs.length,
        openRate: template._count.emailLogs > 0 ? 
          ((template.emailLogs.length / template._count.emailLogs) * 100).toFixed(1) : 0
      }));

      // Get hourly sending patterns (Nigerian business hours)
      const hourlyPattern = await prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Lagos') as hour,
          COUNT(*) as email_count,
          AVG(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) * 100 as avg_open_rate
        FROM email_logs 
        WHERE company_id = ${companyId} 
          AND created_at >= ${startDate}
          AND status = 'SENT'
        GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Lagos')
        ORDER BY hour
      `;

      return {
        dailyMetrics: dailyMetrics.map(metric => ({
          ...metric,
          dateLagos: format(toZonedTime(metric.date, this.lagosTimezone), 'dd/MM/yyyy')
        })),
        topTemplates: templatesWithStats,
        hourlyPattern: hourlyPattern.map(pattern => ({
          hour: parseInt(pattern.hour),
          emailCount: parseInt(pattern.email_count),
          avgOpenRate: parseFloat(pattern.avg_open_rate || 0).toFixed(1),
          hourLabel: `${pattern.hour}:00 WAT`
        })),
        dateRange,
        lagosTimezone: this.lagosTimezone
      };

    } catch (error) {
      console.error('Error getting engagement analytics:', error);
      throw error;
    }
  }

  /**
   * Schedule Nigerian business hour emails
   */
  async scheduleBusinessHourEmails(emailData) {
    try {
      const { sendDate, preferredHour = 9 } = emailData; // Default to 9 AM WAT

      // Ensure email is scheduled during Nigerian business hours (8 AM - 6 PM WAT)
      const lagosTime = toZonedTime(new Date(sendDate), this.lagosTimezone);
      const businessHour = Math.max(8, Math.min(18, preferredHour));
      
      lagosTime.setHours(businessHour, 0, 0, 0);
      
      // Convert back to UTC for storage
      const scheduledFor = new Date(lagosTime.toISOString());

      const result = await EmailService.sendEmail({
        ...emailData,
        scheduledFor: scheduledFor.toISOString()
      });

      console.log(`📧 Email scheduled for Nigerian business hours: ${format(lagosTime, 'HH:mm dd/MM/yyyy')} WAT`);
      return result;

    } catch (error) {
      console.error('Error scheduling business hour email:', error);
      throw error;
    }
  }

  /**
   * Clean up old email logs
   */
  async cleanupOldEmailLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days

      const deletedCount = await prisma.emailLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ['SENT', 'FAILED'] }
        }
      });

      console.log(`🧹 Cleaned up ${deletedCount.count} old email logs`);
      return deletedCount.count;

    } catch (error) {
      console.error('Error cleaning up email logs:', error);
      throw error;
    }
  }

  /**
   * Generate daily email report
   */
  async generateDailyEmailReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const companies = await prisma.company.findMany({
        select: { id: true, name: true }
      });

      for (const company of companies) {
        const stats = await this.getDeliveryStats(company.id, 1);
        
        if (stats.total > 0) {
          console.log(`📊 Daily Report for ${company.name}:`);
          console.log(`   📧 Total: ${stats.total}, ✅ Sent: ${stats.sent}, 👀 Opened: ${stats.opened}`);
          console.log(`   📈 Delivery Rate: ${stats.deliveryRate}%, Open Rate: ${stats.openRate}%`);
        }
      }

    } catch (error) {
      console.error('Error generating daily email report:', error);
      throw error;
    }
  }

  /**
   * Get email scheduler status
   */
  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      lagosTimezone: this.lagosTimezone,
      currentTime: format(toZonedTime(new Date(), this.lagosTimezone), 'HH:mm dd/MM/yyyy'),
      status: 'active'
    };
  }
}

module.exports = new EmailSchedulerService();