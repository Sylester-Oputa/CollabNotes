const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { 
  authenticateToken, 
  requireRole, 
  requireSameCompany,
  requireDepartmentAccess 
} = require('../middleware/auth');

// Get departments for a company
router.get('/company/:companyId', 
  authenticateToken, 
  requireSameCompany, 
  async (req, res) => {
    try {
      const { companyId } = req.params;

      const departments = await prisma.department.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              users: true,
              notes: true,
              tasks: true
            }
          },
          users: {
            where: { role: 'DEPT_ADMIN' },
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      res.json({ departments });

    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get department details
router.get('/:id', 
  authenticateToken, 
  requireDepartmentAccess, 
  async (req, res) => {
    try {
      const { id } = req.params;

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              notes: true,
              tasks: true
            }
          }
        }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      res.json({ department });

    } catch (error) {
      console.error('Get department error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Add user to department
router.post('/:id/users', 
  authenticateToken,
  requireRole(['SUPER_ADMIN', 'DEPT_ADMIN']),
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['DEPT_ADMIN', 'USER']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id: departmentId } = req.params;
      const { name, email, password, role = 'USER' } = req.body;

      // Verify department exists and user has access
      const department = await prisma.department.findUnique({
        where: { id: departmentId }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      // Check permissions
      if (req.user.role === 'DEPT_ADMIN' && req.user.departmentId !== departmentId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Only super admins can create dept admins
      if (role === 'DEPT_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only super admins can create department admins' });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          companyId: department.companyId,
          departmentId
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'USER_ADDED_TO_DEPARTMENT',
          metadata: {
            newUserEmail: user.email,
            newUserRole: user.role,
            departmentName: department.name
          },
          userId: req.user.id,
          companyId: department.companyId
        }
      });

      res.status(201).json({
        message: 'User added to department successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Add user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Assign department admin
router.patch('/:id/admin',
  authenticateToken,
  requireRole(['SUPER_ADMIN']),
  [
    body('userId').notEmpty().withMessage('User ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id: departmentId } = req.params;
      const { userId } = req.body;

      // Verify department exists
      const department = await prisma.department.findUnique({
        where: { id: departmentId }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      // Verify user exists and is in the same company and department
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId: department.companyId,
          departmentId
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found in this department' });
      }

      // Update user role to department admin
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'DEPT_ADMIN' }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'DEPARTMENT_ADMIN_ASSIGNED',
          metadata: {
            adminEmail: updatedUser.email,
            departmentName: department.name
          },
          userId: req.user.id,
          companyId: department.companyId
        }
      });

      res.json({
        message: 'Department admin assigned successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });

    } catch (error) {
      console.error('Assign admin error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;