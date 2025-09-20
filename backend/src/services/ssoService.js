// Single Sign-On Service for CollabNotes Nigeria
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

class SSOService {
  constructor() {
    this.providers = {
      GOOGLE: 'google',
      MICROSOFT: 'microsoft',
      GITHUB: 'github',
      SAML: 'saml'
    };
  }

  /**
   * Configure SSO provider for a company
   */
  async configureSSOProvider(companyId, adminUserId, config) {
    try {
      const { provider, clientId, clientSecret, domain, metadata } = config;

      // Validate provider
      if (!Object.values(this.providers).includes(provider)) {
        throw new Error('Unsupported SSO provider');
      }

      // Ensure only SUPER_ADMIN can configure SSO
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId }
      });

      if (!admin || admin.role !== 'SUPER_ADMIN' || admin.companyId !== companyId) {
        throw new Error('Only company super admins can configure SSO');
      }

      // Create or update SSO configuration
      const ssoConfig = await prisma.ssoConfiguration.upsert({
        where: {
          companyId_provider: {
            companyId,
            provider
          }
        },
        update: {
          clientId,
          clientSecret: this.encryptSecret(clientSecret),
          domain,
          metadata: metadata || {},
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          companyId,
          provider,
          clientId,
          clientSecret: this.encryptSecret(clientSecret),
          domain,
          metadata: metadata || {},
          isActive: true
        }
      });

      // Log security event
      await this.logSecurityEvent(adminUserId, companyId, 'SSO_CONFIGURED', {
        provider,
        domain,
        timestamp: new Date()
      });

      return {
        success: true,
        message: `${provider.toUpperCase()} SSO configured successfully`,
        configId: ssoConfig.id
      };

    } catch (error) {
      console.error('Error configuring SSO:', error);
      throw new Error('Failed to configure SSO: ' + error.message);
    }
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code, state, companyId) {
    try {
      // Get SSO configuration
      const ssoConfig = await prisma.ssoConfiguration.findFirst({
        where: {
          companyId,
          provider: this.providers.GOOGLE,
          isActive: true
        }
      });

      if (!ssoConfig) {
        throw new Error('Google SSO not configured for this company');
      }

      // Exchange code for access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: ssoConfig.clientId,
        client_secret: this.decryptSecret(ssoConfig.clientSecret),
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.FRONTEND_URL}/auth/google/callback`
      });

      const { access_token } = tokenResponse.data;

      // Get user profile from Google
      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const googleUser = profileResponse.data;

      // Validate domain if configured
      if (ssoConfig.domain) {
        const emailDomain = googleUser.email.split('@')[1];
        if (emailDomain !== ssoConfig.domain) {
          throw new Error(`Email domain ${emailDomain} not allowed for this organization`);
        }
      }

      // Find or create user
      const user = await this.findOrCreateSSOUser(companyId, googleUser, this.providers.GOOGLE);

      // Generate JWT token
      const token = this.generateJWT(user.id);

      await this.logSecurityEvent(user.id, companyId, 'SSO_LOGIN_SUCCESS', {
        provider: this.providers.GOOGLE,
        email: googleUser.email,
        timestamp: new Date()
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          department: user.department
        }
      };

    } catch (error) {
      console.error('Google SSO error:', error);
      await this.logSecurityEvent(null, companyId, 'SSO_LOGIN_FAILED', {
        provider: this.providers.GOOGLE,
        error: error.message,
        timestamp: new Date()
      });
      throw new Error('Google SSO authentication failed: ' + error.message);
    }
  }

  /**
   * Handle Microsoft OAuth callback
   */
  async handleMicrosoftCallback(code, state, companyId) {
    try {
      const ssoConfig = await prisma.ssoConfiguration.findFirst({
        where: {
          companyId,
          provider: this.providers.MICROSOFT,
          isActive: true
        }
      });

      if (!ssoConfig) {
        throw new Error('Microsoft SSO not configured for this company');
      }

      // Exchange code for access token
      const tokenResponse = await axios.post(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
        client_id: ssoConfig.clientId,
        client_secret: this.decryptSecret(ssoConfig.clientSecret),
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.FRONTEND_URL}/auth/microsoft/callback`,
        scope: 'https://graph.microsoft.com/user.read'
      });

      const { access_token } = tokenResponse.data;

      // Get user profile from Microsoft Graph
      const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      const microsoftUser = profileResponse.data;

      // Transform Microsoft user data to our format
      const userData = {
        id: microsoftUser.id,
        email: microsoftUser.userPrincipalName || microsoftUser.mail,
        name: microsoftUser.displayName,
        given_name: microsoftUser.givenName,
        family_name: microsoftUser.surname
      };

      // Validate domain if configured
      if (ssoConfig.domain) {
        const emailDomain = userData.email.split('@')[1];
        if (emailDomain !== ssoConfig.domain) {
          throw new Error(`Email domain ${emailDomain} not allowed for this organization`);
        }
      }

      const user = await this.findOrCreateSSOUser(companyId, userData, this.providers.MICROSOFT);
      const token = this.generateJWT(user.id);

      await this.logSecurityEvent(user.id, companyId, 'SSO_LOGIN_SUCCESS', {
        provider: this.providers.MICROSOFT,
        email: userData.email,
        timestamp: new Date()
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          department: user.department
        }
      };

    } catch (error) {
      console.error('Microsoft SSO error:', error);
      await this.logSecurityEvent(null, companyId, 'SSO_LOGIN_FAILED', {
        provider: this.providers.MICROSOFT,
        error: error.message,
        timestamp: new Date()
      });
      throw new Error('Microsoft SSO authentication failed: ' + error.message);
    }
  }

  /**
   * Handle SAML authentication
   */
  async handleSAMLCallback(samlResponse, companyId) {
    try {
      const ssoConfig = await prisma.ssoConfiguration.findFirst({
        where: {
          companyId,
          provider: this.providers.SAML,
          isActive: true
        }
      });

      if (!ssoConfig) {
        throw new Error('SAML SSO not configured for this company');
      }

      // Parse SAML response (simplified - would use proper SAML library in production)
      const samlData = this.parseSAMLResponse(samlResponse, ssoConfig.metadata);

      // Validate domain if configured
      if (ssoConfig.domain) {
        const emailDomain = samlData.email.split('@')[1];
        if (emailDomain !== ssoConfig.domain) {
          throw new Error(`Email domain ${emailDomain} not allowed for this organization`);
        }
      }

      const user = await this.findOrCreateSSOUser(companyId, samlData, this.providers.SAML);
      const token = this.generateJWT(user.id);

      await this.logSecurityEvent(user.id, companyId, 'SSO_LOGIN_SUCCESS', {
        provider: this.providers.SAML,
        email: samlData.email,
        timestamp: new Date()
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          department: user.department
        }
      };

    } catch (error) {
      console.error('SAML SSO error:', error);
      await this.logSecurityEvent(null, companyId, 'SSO_LOGIN_FAILED', {
        provider: this.providers.SAML,
        error: error.message,
        timestamp: new Date()
      });
      throw new Error('SAML SSO authentication failed: ' + error.message);
    }
  }

  /**
   * Find or create user from SSO provider
   */
  async findOrCreateSSOUser(companyId, ssoUserData, provider) {
    try {
      // Check if user exists
      let user = await prisma.user.findFirst({
        where: {
          email: ssoUserData.email,
          companyId
        },
        include: {
          company: true,
          department: true
        }
      });

      if (user) {
        // Update SSO mapping
        await prisma.ssoUserMapping.upsert({
          where: {
            userId_provider: {
              userId: user.id,
              provider
            }
          },
          update: {
            providerId: ssoUserData.id || ssoUserData.email,
            lastLogin: new Date()
          },
          create: {
            userId: user.id,
            provider,
            providerId: ssoUserData.id || ssoUserData.email,
            email: ssoUserData.email,
            lastLogin: new Date()
          }
        });

        return user;
      }

      // Create new user if auto-provisioning is enabled
      const company = await prisma.company.findUnique({
        where: { id: companyId }
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // For Nigerian companies, auto-create users with basic role
      user = await prisma.user.create({
        data: {
          name: ssoUserData.name || ssoUserData.given_name + ' ' + ssoUserData.family_name,
          email: ssoUserData.email,
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), // Random password
          role: 'USER',
          companyId,
          departmentId: null // Will be assigned by admin later
        },
        include: {
          company: true,
          department: true
        }
      });

      // Create SSO mapping
      await prisma.ssoUserMapping.create({
        data: {
          userId: user.id,
          provider,
          providerId: ssoUserData.id || ssoUserData.email,
          email: ssoUserData.email,
          lastLogin: new Date()
        }
      });

      // Log user creation
      await this.logSecurityEvent(user.id, companyId, 'SSO_USER_CREATED', {
        provider,
        email: ssoUserData.email,
        timestamp: new Date()
      });

      return user;

    } catch (error) {
      console.error('Error finding/creating SSO user:', error);
      throw new Error('Failed to authenticate user: ' + error.message);
    }
  }

  /**
   * Get SSO configuration for company
   */
  async getSSOConfiguration(companyId, userId) {
    try {
      // Verify user has access to company
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || user.companyId !== companyId) {
        throw new Error('Access denied');
      }

      const ssoConfigs = await prisma.ssoConfiguration.findMany({
        where: {
          companyId,
          isActive: true
        },
        select: {
          id: true,
          provider: true,
          domain: true,
          isActive: true,
          createdAt: true,
          // Don't return secrets
          clientId: false,
          clientSecret: false
        }
      });

      return {
        success: true,
        configurations: ssoConfigs
      };

    } catch (error) {
      console.error('Error getting SSO configuration:', error);
      throw new Error('Failed to get SSO configuration');
    }
  }

  /**
   * Disable SSO provider
   */
  async disableSSOProvider(companyId, provider, adminUserId) {
    try {
      // Verify admin permissions
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId }
      });

      if (!admin || admin.role !== 'SUPER_ADMIN' || admin.companyId !== companyId) {
        throw new Error('Only company super admins can disable SSO');
      }

      await prisma.ssoConfiguration.updateMany({
        where: {
          companyId,
          provider
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      await this.logSecurityEvent(adminUserId, companyId, 'SSO_DISABLED', {
        provider,
        timestamp: new Date()
      });

      return {
        success: true,
        message: `${provider.toUpperCase()} SSO disabled successfully`
      };

    } catch (error) {
      console.error('Error disabling SSO:', error);
      throw new Error('Failed to disable SSO: ' + error.message);
    }
  }

  // Helper methods

  encryptSecret(secret) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptSecret(encryptedSecret) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  generateJWT(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  parseSAMLResponse(samlResponse, metadata) {
    // Simplified SAML parsing - in production, use proper SAML library like saml2-js
    // This would validate signatures, decrypt assertions, etc.
    
    // Mock implementation for demonstration
    return {
      id: 'saml-user-id',
      email: 'user@company.com',
      name: 'SAML User',
      given_name: 'SAML',
      family_name: 'User'
    };
  }

  async logSecurityEvent(userId, companyId, event, metadata = {}) {
    try {
      await prisma.securityLog.create({
        data: {
          userId,
          companyId,
          event,
          metadata: {
            ...metadata,
            source: 'SSO_SERVICE',
            location: 'Nigeria' // Nigerian companies
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }
}

module.exports = new SSOService();