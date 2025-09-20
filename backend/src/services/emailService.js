// Email Integration Service for CollabNotes Nigeria
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');
const crypto = require('crypto');

const prisma = new PrismaClient();

class EmailService {
  constructor() {
    this.transporter = null;
    this.lagosTimezone = 'Africa/Lagos';
    this.init();
  }

  /**
   * Initialize email transporter
   */
  async init() {
    try {
      if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
        // Production - use configured SMTP
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Development - use test account
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      }
      
      console.log('📧 Email service initialized successfully');
    } catch (error) {
      console.error('Email service initialization error:', error);
      // Fallback transporter for development
      this.transporter = {
        sendMail: async (options) => {
          console.log('📧 Mock email sent:', options.subject);
          return { messageId: crypto.randomUUID() };
        }
      };
    }
  }

  /**
   * Create email template
   */
  async createEmailTemplate(templateData) {
    try {
      const template = await prisma.emailTemplate.create({
        data: {
          name: templateData.name,
          subject: templateData.subject,
          htmlContent: templateData.htmlContent,
          textContent: templateData.textContent,
          category: templateData.category || 'GENERAL',
          companyId: templateData.companyId,
          createdBy: templateData.createdBy,
          variables: templateData.variables || {},
          isActive: true
        },
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          company: {
            select: { id: true, name: true }
          }
        }
      });

      console.log(`📧 Email template created: ${template.name} for company ${template.company.name}`);
      return template;
    } catch (error) {
      console.error('Error creating email template:', error);
      throw new Error('Failed to create email template');
    }
  }

  /**
   * Send email from template
   */
  async sendEmailFromTemplate(templateId, emailData) {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
        include: {
          company: true
        }
      });

      if (!template || !template.isActive) {
        throw new Error('Template not found or inactive');
      }

      // Replace variables in template
      let subject = template.subject;
      let htmlContent = template.htmlContent;
      let textContent = template.textContent;

      if (emailData.variables) {
        Object.keys(emailData.variables).forEach(key => {
          const value = emailData.variables[key] || '';
          const regex = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(regex, value);
          htmlContent = htmlContent.replace(regex, value);
          textContent = textContent.replace(regex, value);
        });
      }

      // Add Nigerian business context
      const lagosTime = toZonedTime(new Date(), this.lagosTimezone);
      const currentDate = format(lagosTime, 'dd/MM/yyyy');
      const currentTime = format(lagosTime, 'HH:mm');

      subject = subject.replace(/{{currentDate}}/g, currentDate);
      htmlContent = htmlContent.replace(/{{currentDate}}/g, currentDate);
      htmlContent = htmlContent.replace(/{{currentTime}}/g, currentTime);
      textContent = textContent.replace(/{{currentDate}}/g, currentDate);
      textContent = textContent.replace(/{{currentTime}}/g, currentTime);

      // Send email
      const result = await this.sendEmail({
        to: emailData.recipients,
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent,
        templateId: templateId,
        sentBy: emailData.sentBy,
        companyId: template.companyId,
        scheduledFor: emailData.scheduledFor
      });

      return result;
    } catch (error) {
      console.error('Error sending email from template:', error);
      throw error;
    }
  }

  /**
   * Send email directly
   */
  async sendEmail(emailData) {
    try {
      // Create email log record
      const emailLog = await prisma.emailLog.create({
        data: {
          recipients: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
          subject: emailData.subject,
          htmlContent: emailData.htmlContent,
          textContent: emailData.textContent,
          templateId: emailData.templateId || null,
          sentBy: emailData.sentBy,
          companyId: emailData.companyId,
          status: emailData.scheduledFor ? 'QUEUED' : 'DRAFT',
          scheduledFor: emailData.scheduledFor ? new Date(emailData.scheduledFor) : null,
          metadata: {
            lagosTimezone: this.lagosTimezone,
            userAgent: emailData.userAgent || 'CollabNotes-Server',
            clientIP: emailData.clientIP || 'unknown'
          }
        }
      });

      // If scheduled for later, don't send now
      if (emailData.scheduledFor) {
        const lagosScheduledTime = format(
          toZonedTime(new Date(emailData.scheduledFor), this.lagosTimezone), 
          'HH:mm dd/MM/yyyy'
        );
        console.log(`📧 Email scheduled for ${lagosScheduledTime} WAT: ${emailData.subject}`);
        return { 
          emailLogId: emailLog.id, 
          status: 'queued', 
          scheduledFor: lagosScheduledTime 
        };
      }

      // Send immediately
      const result = await this.sendEmailNow(emailLog.id);
      return { 
        emailLogId: emailLog.id, 
        status: 'sent',
        messageId: result.messageId 
      };

    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send email immediately
   */
  async sendEmailNow(emailLogId) {
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: emailLogId }
      });

      if (!emailLog) {
        throw new Error('Email log not found');
      }

      // Add tracking pixel to HTML content
      const trackingPixelUrl = `${process.env.API_URL || 'http://localhost:5001'}/api/communication/email/track/${emailLogId}`;
      const htmlWithTracking = emailLog.htmlContent ? 
        emailLog.htmlContent + `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="">` : 
        null;

      const mailOptions = {
        from: `"CollabNotes Nigeria" <${process.env.FROM_EMAIL || 'noreply@collabnotes.ng'}>`,
        to: emailLog.recipients.join(', '),
        subject: emailLog.subject,
        text: emailLog.textContent,
        html: htmlWithTracking
      };

      const info = await this.transporter.sendMail(mailOptions);

      // Update email log with success
      const lagosTime = toZonedTime(new Date(), this.lagosTimezone);
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: info.messageId,
          metadata: {
            ...emailLog.metadata,
            smtpResponse: info.response,
            sentAtLagos: format(lagosTime, 'HH:mm dd/MM/yyyy')
          }
        }
      });

      console.log(`📧 Email sent successfully: ${emailLog.subject} (${info.messageId})`);
      return info;

    } catch (error) {
      console.error('Error sending email now:', error);
      
      // Update email log with error
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  /**
   * Track email open
   */
  async trackEmailOpen(emailLogId) {
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: emailLogId }
      });

      if (!emailLog) {
        return;
      }

      // Update opened status if not already opened
      if (!emailLog.openedAt) {
        const lagosTime = toZonedTime(new Date(), this.lagosTimezone);
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: {
            openedAt: new Date(),
            metadata: {
              ...emailLog.metadata,
              openedAtLagos: format(lagosTime, 'HH:mm dd/MM/yyyy')
            }
          }
        });

        console.log(`📧 Email opened: ${emailLog.subject}`);
      }
    } catch (error) {
      console.error('Error tracking email open:', error);
    }
  }

  /**
   * Process scheduled emails
   */
  async processScheduledEmails() {
    try {
      const now = new Date();
      const scheduledEmails = await prisma.emailLog.findMany({
        where: {
          status: 'QUEUED',
          scheduledFor: {
            lte: now
          }
        }
      });

      let processedCount = 0;
      for (const email of scheduledEmails) {
        try {
          await this.sendEmailNow(email.id);
          processedCount++;
        } catch (error) {
          console.error(`Failed to send scheduled email ${email.id}:`, error);
        }
      }

      if (processedCount > 0) {
        console.log(`📧 Processed ${processedCount} scheduled emails`);
      }

      return processedCount;
    } catch (error) {
      console.error('Error processing scheduled emails:', error);
      throw error;
    }
  }

  /**
   * Get email analytics
   */
  async getEmailAnalytics(companyId, dateRange = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const [
        totalEmails,
        sentEmails,
        openedEmails,
        failedEmails,
        queuedEmails
      ] = await Promise.all([
        prisma.emailLog.count({
          where: {
            companyId: companyId,
            createdAt: { gte: startDate }
          }
        }),
        prisma.emailLog.count({
          where: {
            companyId: companyId,
            status: 'SENT',
            createdAt: { gte: startDate }
          }
        }),
        prisma.emailLog.count({
          where: {
            companyId: companyId,
            openedAt: { not: null },
            createdAt: { gte: startDate }
          }
        }),
        prisma.emailLog.count({
          where: {
            companyId: companyId,
            status: 'FAILED',
            createdAt: { gte: startDate }
          }
        }),
        prisma.emailLog.count({
          where: {
            companyId: companyId,
            status: 'QUEUED',
            createdAt: { gte: startDate }
          }
        })
      ]);

      const openRate = sentEmails > 0 ? ((openedEmails / sentEmails) * 100) : 0;
      const deliveryRate = totalEmails > 0 ? ((sentEmails / totalEmails) * 100) : 0;
      const failureRate = totalEmails > 0 ? ((failedEmails / totalEmails) * 100) : 0;

      return {
        totalEmails,
        sentEmails,
        openedEmails,
        failedEmails,
        queuedEmails,
        openRate: parseFloat(openRate.toFixed(1)),
        deliveryRate: parseFloat(deliveryRate.toFixed(1)),
        failureRate: parseFloat(failureRate.toFixed(1)),
        dateRange,
        lagosTimezone: this.lagosTimezone
      };
    } catch (error) {
      console.error('Error getting email analytics:', error);
      throw error;
    }
  }

  /**
   * Get Nigerian business email templates
   */
  getNigerianBusinessTemplates() {
    return {
      welcome: {
        name: 'Nigerian Business Welcome Email',
        subject: 'Welcome to {{companyName}} - Your Journey Begins!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: #2c5282; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">{{companyName}}</h1>
              <p style="margin: 10px 0 0 0;">Nigeria's Leading Business Platform</p>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #2c5282;">Welcome, {{firstName}}!</h2>
              <p>We are absolutely delighted to welcome you to our dynamic team at {{companyName}}. Your expertise and enthusiasm will be invaluable additions to our organization as we continue to drive excellence in Nigerian business.</p>
              
              <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #2c5282; margin: 20px 0;">
                <h3 style="color: #2c5282; margin-top: 0;">Your Details:</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Name:</strong> {{firstName}} {{lastName}}</li>
                  <li><strong>Department:</strong> {{department}}</li>
                  <li><strong>Start Date:</strong> {{startDate}}</li>
                  <li><strong>Office Location:</strong> Lagos, Nigeria</li>
                </ul>
              </div>
              
              <p>As part of our commitment to Nigerian business excellence, you'll have access to our comprehensive collaboration platform designed specifically for the unique needs of Nigerian enterprises.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{loginUrl}}" style="background: #2c5282; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Your Account</a>
              </div>
              
              <p>We look forward to working with you and achieving great success together!</p>
              
              <p style="margin-top: 30px;">Best regards,<br>
              <strong>{{senderName}}</strong><br>
              {{companyName}} Team</p>
              
              <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p>{{companyName}} | Lagos, Nigeria | {{currentDate}} WAT</p>
                <p>This email was sent to {{recipientEmail}}. If you have questions, contact us at support@{{companyDomain}}.</p>
              </div>
            </div>
          </div>
        `,
        textContent: `Welcome to {{companyName}}!

Dear {{firstName}},

We are delighted to welcome you to our team at {{companyName}}. Your expertise will be valuable as we continue to drive excellence in Nigerian business.

Your Details:
- Name: {{firstName}} {{lastName}}
- Department: {{department}}
- Start Date: {{startDate}}
- Location: Lagos, Nigeria

Access your account: {{loginUrl}}

Best regards,
{{companyName}} Team
Lagos, Nigeria - {{currentDate}} WAT`,
        category: 'WELCOME',
        variables: ['companyName', 'firstName', 'lastName', 'department', 'startDate', 'loginUrl', 'senderName', 'recipientEmail', 'companyDomain']
      },
      meeting: {
        name: 'Nigerian Business Meeting Invitation',
        subject: 'Meeting Invitation: {{meetingTitle}} - {{meetingDate}}',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2c5282; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">Meeting Invitation</h1>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #2c5282;">{{meetingTitle}}</h2>
              <p>Dear {{recipientName}},</p>
              <p>You are cordially invited to attend the following important meeting:</p>
              
              <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #2c5282; margin: 20px 0;">
                <h3 style="color: #2c5282; margin-top: 0;">Meeting Details</h3>
                <p><strong>📅 Date:</strong> {{meetingDate}}</p>
                <p><strong>🕐 Time:</strong> {{meetingTime}} (West Africa Time)</p>
                <p><strong>📍 Venue:</strong> {{meetingVenue}}</p>
                <p><strong>👥 Organizer:</strong> {{organizerName}}</p>
                <p><strong>📋 Agenda:</strong> {{meetingAgenda}}</p>
              </div>
              
              <div style="background: #fff5f5; padding: 15px; border-left: 4px solid #e53e3e; margin: 20px 0;">
                <p style="margin: 0;"><strong>Please confirm your attendance by replying to this email by {{confirmByDate}}.</strong></p>
              </div>
              
              <p>This meeting is crucial for our business objectives and your participation is highly valued.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{meetingLink}}" style="background: #2c5282; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Join Meeting (Online)</a>
              </div>
              
              <p>Thank you for your time and commitment.</p>
              
              <p style="margin-top: 30px;">Best regards,<br>
              <strong>{{organizerName}}</strong><br>
              {{companyName}}</p>
              
              <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p>{{companyName}} | Lagos, Nigeria | {{currentDate}} WAT</p>
              </div>
            </div>
          </div>
        `,
        textContent: `Meeting Invitation: {{meetingTitle}}

Dear {{recipientName}},

You are invited to attend:

Meeting Details:
- Title: {{meetingTitle}}
- Date: {{meetingDate}}
- Time: {{meetingTime}} (WAT)
- Venue: {{meetingVenue}}
- Organizer: {{organizerName}}
- Agenda: {{meetingAgenda}}

Please confirm attendance by {{confirmByDate}}.

Join online: {{meetingLink}}

Best regards,
{{organizerName}}
{{companyName}}
Lagos, Nigeria - {{currentDate}} WAT`,
        category: 'MEETING',
        variables: ['meetingTitle', 'recipientName', 'meetingDate', 'meetingTime', 'meetingVenue', 'organizerName', 'meetingAgenda', 'confirmByDate', 'meetingLink', 'companyName']
      }
    };
  }

  /**
   * Get email templates for company
   */
  async getEmailTemplates(companyId, filters = {}) {
    try {
      const { category, search, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const where = {
        companyId: companyId,
        isActive: true
      };

      if (category) where.category = category;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } }
        ];
      }

      const templates = await prisma.emailTemplate.findMany({
        where,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true }
          },
          _count: {
            select: {
              emailLogs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      });

      const total = await prisma.emailTemplate.count({ where });

      return {
        templates: templates.map(template => ({
          ...template,
          usageCount: template._count.emailLogs,
          createdAtLagos: format(
            toZonedTime(template.createdAt, this.lagosTimezone),
            'HH:mm dd/MM/yyyy'
          )
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting email templates:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
