// Role-Based Access Control (RBAC) Middleware
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Role hierarchy and permissions
const ROLE_HIERARCHY = {
  ADMIN: ['ADMIN', 'MANAGER', 'USER'],
  MANAGER: ['MANAGER', 'USER'], 
  USER: ['USER']
};

const WORKFLOW_PERMISSIONS = {
  // Template permissions
  'workflow:template:create': ['ADMIN', 'MANAGER'],
  'workflow:template:read': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:template:update': ['ADMIN', 'MANAGER'],
  'workflow:template:delete': ['ADMIN'],
  
  // Instance permissions
  'workflow:instance:create': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:instance:read': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:instance:update': ['ADMIN', 'MANAGER'],
  'workflow:instance:delete': ['ADMIN', 'MANAGER'],
  
  // Approval permissions
  'workflow:approval:create': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:approval:read': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:approval:respond': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:approval:delegate': ['ADMIN', 'MANAGER'],
  
  // Assignment permissions
  'workflow:assignment:create': ['ADMIN', 'MANAGER'],
  'workflow:assignment:read': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:assignment:update': ['ADMIN', 'MANAGER'],
  'workflow:assignment:delete': ['ADMIN'],
  
  // Library permissions
  'workflow:library:read': ['ADMIN', 'MANAGER', 'USER'],
  'workflow:library:create': ['ADMIN'],
  'workflow:library:update': ['ADMIN'],
  'workflow:library:delete': ['ADMIN']
};

/**
 * Middleware to check if user has required permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware function
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user with role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, companyId: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permission
      const allowedRoles = WORKFLOW_PERMISSIONS[permission];
      if (!allowedRoles) {
        return res.status(403).json({
          success: false,
          message: 'Invalid permission'
        });
      }

      const userRole = user.role;
      const hasPermission = allowedRoles.includes(userRole);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${allowedRoles.join(' or ')}, Current: ${userRole}`
        });
      }

      // Add user context to request
      req.userContext = {
        userId: user.id,
        role: user.role,
        companyId: user.companyId,
        permissions: ROLE_HIERARCHY[userRole] || [userRole]
      };

      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
}

/**
 * Middleware to check if user can access company resources
 * @param {Function} getCompanyId - Function to extract company ID from request
 * @returns {Function} Express middleware function
 */
function requireCompanyAccess(getCompanyId = (req) => req.params.companyId) {
  return async (req, res, next) => {
    try {
      const userCompanyId = req.userContext?.companyId;
      const requestedCompanyId = getCompanyId(req);

      if (!userCompanyId) {
        return res.status(401).json({
          success: false,
          message: 'User company context missing'
        });
      }

      if (requestedCompanyId && requestedCompanyId !== userCompanyId) {
        // Admin can access other companies (for system admin purposes)
        if (req.userContext.role !== 'ADMIN') {
          return res.status(403).json({
            success: false,
            message: 'Access denied to company resources'
          });
        }
      }

      next();
    } catch (error) {
      console.error('Company access middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Company access check failed'
      });
    }
  };
}

/**
 * Check if user can access specific resource by ownership
 * @param {Function} getOwnerId - Function to extract owner ID from resource
 * @returns {Function} Express middleware function
 */
function requireOwnershipOrRole(requiredRoles = ['ADMIN', 'MANAGER']) {
  return async (req, res, next) => {
    try {
      const userRole = req.userContext?.role;
      const userId = req.userContext?.userId;

      // Admin and Manager can access any resource
      if (requiredRoles.includes(userRole)) {
        return next();
      }

      // For regular users, check ownership
      // This would need to be implemented per resource type
      // For now, just pass through - specific routes can add ownership checks
      next();
    } catch (error) {
      console.error('Ownership middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Ownership check failed'
      });
    }
  };
}

/**
 * Mock authentication middleware for testing
 * In production, this would validate JWT tokens
 */
function mockAuth(req, res, next) {
  // Mock user for testing - in production this would come from JWT
  req.user = {
    id: 'test-user-123',
    role: 'ADMIN',
    companyId: 'test-company-123'
  };
  next();
}

/**
 * Legacy wrapper for requirePermission to maintain compatibility
 * @param {string[]} roles - Required roles
 * @returns {Function} Express middleware function
 */
function requireRole(roles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, companyId: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const hasRole = roles.includes(user.role);
      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${roles.join(' or ')}, Current: ${user.role}`
        });
      }

      req.userContext = {
        userId: user.id,
        role: user.role,
        companyId: user.companyId,
        permissions: ROLE_HIERARCHY[user.role] || [user.role]
      };

      next();
    } catch (error) {
      console.error('requireRole middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireRole, // Legacy compatibility
  requireCompanyAccess,
  requireOwnershipOrRole,
  mockAuth,
  WORKFLOW_PERMISSIONS,
  ROLE_HIERARCHY
};