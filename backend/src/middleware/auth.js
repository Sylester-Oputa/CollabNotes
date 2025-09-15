const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user with company and department details
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        company: true,
        department: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
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
      return res.status(401).json({ error: 'Authentication required' });
    }

    const departmentId = req.params.departmentId || req.body.departmentId;
    
    if (!departmentId) {
      return next();
    }

    // Super admins can access any department in their company
    if (req.user.role === 'SUPER_ADMIN') {
      const department = await prisma.department.findUnique({
        where: { id: departmentId }
      });

      if (!department || department.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied to this department' });
      }

      return next();
    }

    // Department admins and users can only access their own department
    if (req.user.departmentId !== departmentId) {
      return res.status(403).json({ error: 'Access denied to this department' });
    }

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