const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ error: 'Access token required' });
    }

    console.log('Token received, verifying...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', { userId: decoded.userId });
    
    // Fetch user with company and department details
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        company: true,
        department: true
      }
    });

    if (!user) {
      console.log('User not found for token:', decoded.userId);
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('User authenticated:', { 
      userId: user.id, 
      userRole: user.role, 
      userEmail: user.email 
    });
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireSameCompany = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const companyId = req.params.companyId || req.body.companyId;
  
  if (companyId && req.user.companyId !== companyId) {
    return res.status(403).json({ error: 'Access denied to this company' });
  }

  next();
};

const requireDepartmentAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      console.log('Department access: No user in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const departmentId = req.params.departmentId || req.body.departmentId || req.params.id;
    console.log('Department access check:', { 
      departmentId, 
      userRole: req.user.role, 
      userDepartmentId: req.user.departmentId,
      userCompanyId: req.user.companyId 
    });
    
    if (!departmentId) {
      console.log('No departmentId, skipping check');
      return next();
    }

    // Super admins can access any department in their company
    if (req.user.role === 'SUPER_ADMIN') {
      const department = await prisma.department.findUnique({
        where: { id: departmentId }
      });

      console.log('Super admin access check:', { department, departmentId });

      if (!department || department.companyId !== req.user.companyId) {
        console.log('Access denied for super admin:', { 
          departmentExists: !!department, 
          departmentCompanyId: department?.companyId,
          userCompanyId: req.user.companyId 
        });
        return res.status(403).json({ error: 'Access denied to this department' });
      }

      console.log('Super admin access granted');
      return next();
    }

    // Department admins and users can only access their own department
    if (req.user.departmentId !== departmentId) {
      console.log('Department access denied:', { 
        userDepartmentId: req.user.departmentId, 
        requestedDepartmentId: departmentId 
      });
      return res.status(403).json({ error: 'Access denied to this department' });
    }

    console.log('Department access granted');
    next();
  } catch (error) {
    console.error('Department access error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireSameCompany,
  requireDepartmentAccess
};