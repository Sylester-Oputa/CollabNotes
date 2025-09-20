// Two-Factor Authentication Service for CollabNotes Nigeria
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('./emailService');

const prisma = new PrismaClient();

class TwoFactorAuthService {
  constructor() {
    this.issuer = 'CollabNotes Nigeria';
    this.serviceName = 'CollabNotes';
  }

  /**
   * Generate a new 2FA secret for a user
   */
  async generateSecret(userId, userEmail, userName) {
    try {
      const secret = speakeasy.generateSecret({
        issuer: this.issuer,
        name: `${this.serviceName} (${userEmail})`,
        length: 32
      });

      // Store the temporary secret (not yet verified)
      await prisma.twoFactorAuth.upsert({
        where: { userId },
        update: {
          tempSecret: secret.base32,
          isEnabled: false,
          backupCodes: null
        },
        create: {
          userId,
          tempSecret: secret.base32,
          isEnabled: false,
          method: 'AUTHENTICATOR'
        }
      });

      // Generate QR code for authenticator apps
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        backupCodes: this.generateBackupCodes()
      };

    } catch (error) {
      console.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Verify 2FA token during setup
   */
  async verifySetup(userId, token) {
    try {
      const twoFA = await prisma.twoFactorAuth.findUnique({
        where: { userId }
      });

      if (!twoFA || !twoFA.tempSecret) {
        throw new Error('No 2FA setup in progress');
      }

      const verified = speakeasy.totp.verify({
        secret: twoFA.tempSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow 30-second window
      });

      if (verified) {
        // Move temp secret to active secret and generate backup codes
        const backupCodes = this.generateBackupCodes();
        const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

        await prisma.twoFactorAuth.update({
          where: { userId },
          data: {
            secret: twoFA.tempSecret,
            tempSecret: null,
            isEnabled: true,
            backupCodes: JSON.stringify(hashedBackupCodes),
            enabledAt: new Date()
          }
        });

        // Log security event
        await this.logSecurityEvent(userId, '2FA_ENABLED', {
          method: 'AUTHENTICATOR',
          timestamp: new Date()
        });

        return {
          success: true,
          backupCodes: backupCodes,
          message: '2FA has been successfully enabled'
        };
      }

      return {
        success: false,
        message: 'Invalid verification code'
      };

    } catch (error) {
      console.error('Error verifying 2FA setup:', error);
      throw new Error('Failed to verify 2FA setup');
    }
  }

  /**
   * Verify 2FA token during login
   */
  async verifyLogin(userId, token) {
    try {
      const twoFA = await prisma.twoFactorAuth.findUnique({
        where: { userId }
      });

      if (!twoFA || !twoFA.isEnabled || !twoFA.secret) {
        return { success: false, message: '2FA not enabled for this user' };
      }

      // Check if it's a backup code
      if (token.length === 8 && /^[0-9a-f]{8}$/i.test(token)) {
        return this.verifyBackupCode(userId, token);
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: twoFA.secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (verified) {
        // Update last used timestamp
        await prisma.twoFactorAuth.update({
          where: { userId },
          data: { lastUsed: new Date() }
        });

        await this.logSecurityEvent(userId, '2FA_LOGIN_SUCCESS', {
          method: 'AUTHENTICATOR',
          timestamp: new Date()
        });

        return { success: true, message: '2FA verification successful' };
      }

      await this.logSecurityEvent(userId, '2FA_LOGIN_FAILED', {
        method: 'AUTHENTICATOR',
        token: token.substring(0, 2) + '****',
        timestamp: new Date()
      });

      return { success: false, message: 'Invalid 2FA code' };

    } catch (error) {
      console.error('Error verifying 2FA login:', error);
      throw new Error('Failed to verify 2FA code');
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId, code) {
    try {
      const twoFA = await prisma.twoFactorAuth.findUnique({
        where: { userId }
      });

      if (!twoFA || !twoFA.backupCodes) {
        return { success: false, message: 'No backup codes available' };
      }

      const backupCodes = JSON.parse(twoFA.backupCodes);
      const hashedCode = this.hashBackupCode(code);

      const codeIndex = backupCodes.findIndex(bc => bc === hashedCode);
      if (codeIndex === -1) {
        await this.logSecurityEvent(userId, '2FA_BACKUP_CODE_FAILED', {
          code: code.substring(0, 2) + '****',
          timestamp: new Date()
        });
        return { success: false, message: 'Invalid backup code' };
      }

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      await prisma.twoFactorAuth.update({
        where: { userId },
        data: { 
          backupCodes: JSON.stringify(backupCodes),
          lastUsed: new Date()
        }
      });

      await this.logSecurityEvent(userId, '2FA_BACKUP_CODE_USED', {
        remainingCodes: backupCodes.length,
        timestamp: new Date()
      });

      return { 
        success: true, 
        message: 'Backup code verified successfully',
        remainingCodes: backupCodes.length
      };

    } catch (error) {
      console.error('Error verifying backup code:', error);
      throw new Error('Failed to verify backup code');
    }
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId, password) {
    try {
      // Verify user password before disabling 2FA
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }

      // Disable 2FA
      await prisma.twoFactorAuth.update({
        where: { userId },
        data: {
          isEnabled: false,
          secret: null,
          tempSecret: null,
          backupCodes: null,
          disabledAt: new Date()
        }
      });

      await this.logSecurityEvent(userId, '2FA_DISABLED', {
        timestamp: new Date()
      });

      return { success: true, message: '2FA has been disabled' };

    } catch (error) {
      console.error('Error disabling 2FA:', error);
      throw new Error('Failed to disable 2FA');
    }
  }

  /**
   * Get user's 2FA status
   */
  async getUserStatus(userId) {
    try {
      const twoFA = await prisma.twoFactorAuth.findUnique({
        where: { userId },
        select: {
          isEnabled: true,
          method: true,
          enabledAt: true,
          lastUsed: true,
          backupCodes: true
        }
      });

      if (!twoFA) {
        return {
          isEnabled: false,
          method: null,
          backupCodesCount: 0
        };
      }

      const backupCodes = twoFA.backupCodes ? JSON.parse(twoFA.backupCodes) : [];

      return {
        isEnabled: twoFA.isEnabled,
        method: twoFA.method,
        enabledAt: twoFA.enabledAt,
        lastUsed: twoFA.lastUsed,
        backupCodesCount: backupCodes.length
      };

    } catch (error) {
      console.error('Error getting user 2FA status:', error);
      throw new Error('Failed to get 2FA status');
    }
  }

  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId, password) {
    try {
      // Verify password
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }

      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

      await prisma.twoFactorAuth.update({
        where: { userId },
        data: {
          backupCodes: JSON.stringify(hashedBackupCodes)
        }
      });

      await this.logSecurityEvent(userId, '2FA_BACKUP_CODES_REGENERATED', {
        timestamp: new Date()
      });

      return {
        success: true,
        backupCodes: backupCodes,
        message: 'New backup codes generated'
      };

    } catch (error) {
      console.error('Error generating backup codes:', error);
      throw new Error('Failed to generate backup codes');
    }
  }

  /**
   * Send 2FA via Email (Free alternative to SMS)
   */
  async sendEmail2FA(userId, email) {
    try {
      const code = this.generateEmailCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store email code
      await prisma.emailVerification.upsert({
        where: { userId },
        update: {
          code: this.hashEmailCode(code),
          email,
          expiresAt,
          attempts: 0
        },
        create: {
          userId,
          code: this.hashEmailCode(code),
          email,
          expiresAt,
          attempts: 0
        }
      });

      // Send email with verification code
      await sendEmail(
        email,
        'CollabNotes Nigeria - Verification Code',
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">CollabNotes Nigeria</h2>
          <h3>Your Verification Code</h3>
          <p>Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated message from CollabNotes Nigeria. 
            Please do not reply to this email.
          </p>
        </div>
        `
      );

      await this.logSecurityEvent(userId, '2FA_EMAIL_SENT', {
        email: email.substring(0, 3) + '***@' + email.split('@')[1],
        timestamp: new Date()
      });

      return {
        success: true,
        message: 'Verification code sent via email',
        expiresAt
      };

    } catch (error) {
      console.error('Error sending email 2FA:', error);
      throw new Error('Failed to send email verification');
    }
  }

  /**
   * Verify email 2FA code
   */
  async verifyEmail2FA(userId, code) {
    try {
      const emailVerification = await prisma.emailVerification.findUnique({
        where: { userId }
      });

      if (!emailVerification) {
        return { success: false, message: 'No email verification in progress' };
      }

      if (new Date() > emailVerification.expiresAt) {
        return { success: false, message: 'Verification code has expired' };
      }

      if (emailVerification.attempts >= 3) {
        return { success: false, message: 'Too many attempts. Please request a new code.' };
      }

      const hashedCode = this.hashEmailCode(code);
      if (hashedCode !== emailVerification.code) {
        // Increment attempts
        await prisma.emailVerification.update({
          where: { userId },
          data: { attempts: emailVerification.attempts + 1 }
        });

        await this.logSecurityEvent(userId, '2FA_EMAIL_FAILED', {
          attempts: emailVerification.attempts + 1,
          timestamp: new Date()
        });

        return { success: false, message: 'Invalid verification code' };
      }

      // Success - cleanup verification record
      await prisma.emailVerification.delete({
        where: { userId }
      });

      await this.logSecurityEvent(userId, '2FA_EMAIL_SUCCESS', {
        timestamp: new Date()
      });

      return { success: true, message: 'Email verification successful' };

    } catch (error) {
      console.error('Error verifying email 2FA:', error);
      throw new Error('Failed to verify email code');
    }
  }

  // Helper methods

  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex'));
    }
    return codes;
  }

  hashBackupCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  generateSMSCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  hashSMSCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  generateEmailCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  hashEmailCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  async logSecurityEvent(userId, event, metadata = {}) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true }
      });

      await prisma.securityLog.create({
        data: {
          userId,
          companyId: user.companyId,
          event,
          metadata: {
            ...metadata,
            userAgent: metadata.userAgent || 'Unknown',
            ipAddress: metadata.ipAddress || 'Unknown',
            location: metadata.location || 'Nigeria'
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }
}

module.exports = new TwoFactorAuthService();