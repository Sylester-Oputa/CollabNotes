// Advanced Security Routes for CollabNotes Nigeria
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const twoFactorAuthService = require('../services/twoFactorAuth');
const ssoService = require('../services/ssoService');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting for security endpoints
const securityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many security requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

// ========== TWO-FACTOR AUTHENTICATION ==========

// Get user's 2FA status
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await twoFactorAuthService.getUserStatus(userId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// Setup 2FA - Generate QR code and secret
router.post('/2fa/setup', authenticateToken, securityRateLimit, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const userName = req.user.name;

    const setupData = await twoFactorAuthService.generateSecret(userId, userEmail, userName);
    
    res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app',
      ...setupData
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify 2FA setup
router.post('/2fa/verify-setup', authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token || token.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit code required' });
    }

    const result = await twoFactorAuthService.verifySetup(userId, token);
    
    res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
});

// Verify 2FA during login
router.post('/2fa/verify-login', authRateLimit, async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token required' });
    }

    const result = await twoFactorAuthService.verifyLogin(userId, token);
    
    res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA login:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, securityRateLimit, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({ error: 'Current password required to disable 2FA' });
    }

    const result = await twoFactorAuthService.disable2FA(userId, password);
    
    res.json(result);
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate new backup codes
router.post('/2fa/backup-codes', authenticateToken, securityRateLimit, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({ error: 'Current password required' });
    }

    const result = await twoFactorAuthService.generateNewBackupCodes(userId, password);
    
    res.json(result);
  } catch (error) {
    console.error('Error generating backup codes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send 2FA via SMS (Nigerian phone numbers)
router.post('/2fa/sms/send', authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user.id;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Nigerian phone number required' });
    }

    const result = await twoFactorAuthService.sendSMS2FA(userId, phoneNumber);
    
    res.json(result);
  } catch (error) {
    console.error('Error sending SMS 2FA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify SMS 2FA
router.post('/2fa/sms/verify', authenticateToken, authRateLimit, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit SMS code required' });
    }

    const result = await twoFactorAuthService.verifySMS2FA(userId, code);
    
    res.json(result);
  } catch (error) {
    console.error('Error verifying SMS 2FA:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SINGLE SIGN-ON (SSO) ==========

// Get SSO configuration for company
router.get('/sso/config', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    const result = await ssoService.getSSOConfiguration(companyId, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting SSO config:', error);
    res.status(500).json({ error: 'Failed to get SSO configuration' });
  }
});

// Configure SSO provider (Admin only)
router.post('/sso/config', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { provider, clientId, clientSecret, domain, metadata } = req.body;
    const companyId = req.user.companyId;
    const adminUserId = req.user.id;

    if (!provider || !clientId || !clientSecret) {
      return res.status(400).json({ 
        error: 'Provider, client ID, and client secret are required' 
      });
    }

    const result = await ssoService.configureSSOProvider(companyId, adminUserId, {
      provider,
      clientId,
      clientSecret,
      domain,
      metadata
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error configuring SSO:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disable SSO provider (Admin only)
router.post('/sso/disable', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { provider } = req.body;
    const companyId = req.user.companyId;
    const adminUserId = req.user.id;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const result = await ssoService.disableSSOProvider(companyId, provider, adminUserId);
    
    res.json(result);
  } catch (error) {
    console.error('Error disabling SSO:', error);
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth callback
router.post('/sso/google/callback', async (req, res) => {
  try {
    const { code, state, companyId } = req.body;

    if (!code || !companyId) {
      return res.status(400).json({ error: 'Authorization code and company ID required' });
    }

    const result = await ssoService.handleGoogleCallback(code, state, companyId);
    
    res.json(result);
  } catch (error) {
    console.error('Google SSO callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Microsoft OAuth callback
router.post('/sso/microsoft/callback', async (req, res) => {
  try {
    const { code, state, companyId } = req.body;

    if (!code || !companyId) {
      return res.status(400).json({ error: 'Authorization code and company ID required' });
    }

    const result = await ssoService.handleMicrosoftCallback(code, state, companyId);
    
    res.json(result);
  } catch (error) {
    console.error('Microsoft SSO callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SAML callback
router.post('/sso/saml/callback', async (req, res) => {
  try {
    const { samlResponse, companyId } = req.body;

    if (!samlResponse || !companyId) {
      return res.status(400).json({ error: 'SAML response and company ID required' });
    }

    const result = await ssoService.handleSAMLCallback(samlResponse, companyId);
    
    res.json(result);
  } catch (error) {
    console.error('SAML SSO callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== AUDIT LOGS ==========

// Get audit logs for company
router.get('/audit-logs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { page = 1, limit = 50, action, resource, userId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { companyId };

    // Add filters
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (resource) where.resource = { contains: resource, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ========== SECURITY LOGS ==========

// Get security logs for company
router.get('/security-logs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { page = 1, limit = 50, event, userId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { companyId };

    // Add filters
    if (event) where.event = { contains: event, mode: 'insensitive' };
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [securityLogs, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      prisma.securityLog.count({ where })
    ]);

    res.json({
      success: true,
      securityLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching security logs:', error);
    res.status(500).json({ error: 'Failed to fetch security logs' });
  }
});

// ========== LOGIN SESSIONS ==========

// Get active login sessions for user
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const sessions = await prisma.loginSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastActivity: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        location: true,
        lastActivity: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Terminate a specific session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    await prisma.loginSession.updateMany({
      where: {
        id: sessionId,
        userId
      },
      data: {
        isActive: false
      }
    });

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Terminate all other sessions
router.delete('/sessions/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionToken = req.headers.authorization?.split(' ')[1];

    // Get current session to exclude it
    const currentSession = await prisma.loginSession.findFirst({
      where: {
        userId,
        sessionToken: currentSessionToken
      }
    });

    await prisma.loginSession.updateMany({
      where: {
        userId,
        isActive: true,
        id: { not: currentSession?.id }
      },
      data: {
        isActive: false
      }
    });

    res.json({
      success: true,
      message: 'All other sessions terminated successfully'
    });
  } catch (error) {
    console.error('Error terminating sessions:', error);
    res.status(500).json({ error: 'Failed to terminate sessions' });
  }
});

// ========== PASSWORD MANAGEMENT ==========

// Change password with security checks
router.post('/password/change', authenticateToken, securityRateLimit, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Password strength validation
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }

    // Get user and verify current password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Check password history (prevent reusing last 5 passwords)
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    for (const oldPassword of passwordHistory) {
      const isReused = await bcrypt.compare(newPassword, oldPassword.passwordHash);
      if (isReused) {
        return res.status(400).json({ 
          error: 'Cannot reuse one of your last 5 passwords' 
        });
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and add to history
    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      // Add old password to history
      await tx.passwordHistory.create({
        data: {
          userId,
          passwordHash: user.passwordHash
        }
      });

      // Keep only last 10 passwords in history
      const allHistory = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (allHistory.length > 10) {
        const toDelete = allHistory.slice(10);
        await tx.passwordHistory.deleteMany({
          where: {
            id: { in: toDelete.map(h => h.id) }
          }
        });
      }

      // Log security event
      await tx.securityLog.create({
        data: {
          userId,
          companyId: user.companyId,
          event: 'PASSWORD_CHANGED',
          metadata: {
            timestamp: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        }
      });
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ========== SECURITY OVERVIEW ==========

// Get security overview for user
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    // Get 2FA status
    const twoFactorAuth = await prisma.twoFactorAuth.findUnique({
      where: { userId },
      select: { isEnabled: true, isVerified: true }
    });

    // Get active sessions count
    const activeSessions = await prisma.loginSession.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    });

    // Get recent security events
    const recentEvents = await prisma.securityLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        event: true,
        timestamp: true,
        metadata: true
      }
    });

    // Get last password change
    const lastPasswordChange = await prisma.passwordHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    // Calculate security score
    let securityScore = 30; // Base score
    
    if (twoFactorAuth?.isEnabled && twoFactorAuth?.isVerified) {
      securityScore += 40; // Strong 2FA boost
    }
    
    if (lastPasswordChange && 
        new Date() - lastPasswordChange.createdAt < 90 * 24 * 60 * 60 * 1000) {
      securityScore += 20; // Recent password change
    }
    
    if (activeSessions <= 2) {
      securityScore += 10; // Limited active sessions
    }

    res.json({
      success: true,
      data: {
        securityScore: Math.min(securityScore, 100),
        twoFactorAuth: {
          isEnabled: twoFactorAuth?.isEnabled || false,
          isVerified: twoFactorAuth?.isVerified || false
        },
        activeSessions,
        recentEvents,
        lastPasswordChange: lastPasswordChange?.createdAt,
        recommendations: securityScore < 70 ? [
          !twoFactorAuth?.isEnabled ? 'Enable Two-Factor Authentication' : null,
          activeSessions > 3 ? 'Review and close unused sessions' : null,
          !lastPasswordChange || new Date() - lastPasswordChange.createdAt > 90 * 24 * 60 * 60 * 1000 
            ? 'Update your password regularly' : null
        ].filter(Boolean) : []
      }
    });
  } catch (error) {
    console.error('Error fetching security overview:', error);
    res.status(500).json({ error: 'Failed to fetch security overview' });
  }
});

module.exports = router;