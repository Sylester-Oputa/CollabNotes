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

// Get all departments (for company admins)
router.get('/', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN']), 
  async (req, res) => {
    try {
      const departments = await prisma.department.findMany({
        where: { companyId: req.user.companyId },
        include: {
          _count: {
            select: {
              users: true,
              notes: true,
              tasks: true
            }
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              departmentRole: true,
              createdAt: true
            },
            orderBy: [
              { role: 'desc' }, // HEAD_OF_DEPARTMENT first
              { name: 'asc' }
            ]
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(departments);

    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Create department
router.post('/', 
  authenticateToken, 
  requireRole(['SUPER_ADMIN']), 
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Department name must be 2-50 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name } = req.body;

      // Check if department already exists in this company
      const existingDepartment = await prisma.department.findFirst({
        where: {
          name: name.trim(),
          companyId: req.user.companyId
        }
      });

      if (existingDepartment) {
        return res.status(400).json({ error: 'Department with this name already exists' });
      }

      const department = await prisma.department.create({
        data: {
          name: name.trim(),
          companyId: req.user.companyId
        },
        include: {
          _count: {
            select: {
              users: true,
              notes: true,
              tasks: true
            }
          }
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'DEPARTMENT_CREATED',
          metadata: {
            departmentName: department.name
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.status(201).json(department);

    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

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

// Assign head of department
router.patch('/:id/head',
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

      // Check if there's already a head of department
      const existingHead = await prisma.user.findFirst({
        where: {
          departmentId,
          role: 'HEAD_OF_DEPARTMENT'
        }
      });

      if (existingHead && existingHead.id !== userId) {
        return res.status(400).json({ 
          error: 'Department already has a head. Remove the current head first.' 
        });
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

      // Update user role to head of department
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'HEAD_OF_DEPARTMENT' }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'HEAD_OF_DEPARTMENT_ASSIGNED',
          metadata: {
            headEmail: updatedUser.email,
            departmentName: department.name
          },
          userId: req.user.id,
          companyId: department.companyId
        }
      });

      res.json({
        message: 'Head of department assigned successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          departmentRole: updatedUser.departmentRole
        }
      });

    } catch (error) {
      console.error('Assign head error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Remove head of department
router.patch('/:id/remove-head',
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

      // Verify user exists and is head of department
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId: department.companyId,
          departmentId,
          role: 'HEAD_OF_DEPARTMENT'
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User is not head of this department' });
      }

      // Update user role to regular user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: 'USER' }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'HEAD_OF_DEPARTMENT_REMOVED',
          metadata: {
            previousHeadEmail: updatedUser.email,
            departmentName: department.name
          },
          userId: req.user.id,
          companyId: department.companyId
        }
      });

      res.json({
        message: 'Head of department removed successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          departmentRole: updatedUser.departmentRole
        }
      });

    } catch (error) {
      console.error('Remove head error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Delete department
router.delete('/:id',
  authenticateToken,
  requireRole(['SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { id: departmentId } = req.params;

      // Verify department exists and belongs to user's company
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
          users: true,
          _count: {
            select: {
              users: true,
              notes: true,
              tasks: true
            }
          }
        }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      if (department.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if department has users
      if (department._count.users > 0) {
        return res.status(400).json({ 
          error: `Cannot delete department with ${department._count.users} users. Remove all users first.`,
          details: {
            usersCount: department._count.users,
            notesCount: department._count.notes,
            tasksCount: department._count.tasks
          }
        });
      }

      // Delete the department
      await prisma.department.delete({
        where: { id: departmentId }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'DEPARTMENT_DELETED',
          metadata: {
            departmentName: department.name,
            deletedAt: new Date().toISOString()
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({
        message: `Department "${department.name}" deleted successfully`
      });

    } catch (error) {
      console.error('Delete department error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Remove user from department
router.delete('/:id/users/:userId',
  authenticateToken,
  requireRole(['SUPER_ADMIN', 'HEAD_OF_DEPARTMENT']),
  async (req, res) => {
    try {
      const { id: departmentId, userId } = req.params;

      // Verify department exists and belongs to user's company
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
          users: {
            where: { id: userId }
          }
        }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      if (department.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check if user exists in department
      const userToRemove = department.users[0];
      if (!userToRemove) {
        return res.status(404).json({ error: 'User not found in this department' });
      }

      // Super admin can remove anyone, head can only remove non-heads
      if (req.user.role === 'HEAD_OF_DEPARTMENT') {
        // Head of department cannot remove themselves
        if (userId === req.user.id) {
          return res.status(400).json({ error: 'You cannot remove yourself' });
        }
        
        // Head cannot remove other heads - must request approval
        if (userToRemove.role === 'HEAD_OF_DEPARTMENT') {
          return res.status(400).json({ 
            error: 'Cannot remove department head directly. Please request approval from super admin.' 
          });
        }

        // Head of department can only remove users from their own department
        if (req.user.departmentId !== departmentId) {
          return res.status(403).json({ error: 'You can only remove users from your own department' });
        }
      }

      // Remove user (this will cascade delete their notes and tasks based on schema)
      await prisma.user.delete({
        where: { id: userId }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'USER_REMOVED_FROM_DEPARTMENT',
          metadata: {
            removedUserEmail: userToRemove.email,
            removedUserName: userToRemove.name,
            departmentName: department.name,
            removedBy: req.user.role
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({
        message: `User "${userToRemove.name}" removed successfully`
      });

    } catch (error) {
      console.error('Remove user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Request user removal (for department heads)
router.post('/:id/users/:userId/request-removal',
  authenticateToken,
  requireRole(['HEAD_OF_DEPARTMENT']),
  [
    body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id: departmentId, userId } = req.params;
      const { reason } = req.body;

      // Verify department exists and user is head of this department
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
          users: {
            where: { id: userId }
          }
        }
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      if (req.user.departmentId !== departmentId) {
        return res.status(403).json({ error: 'You can only request removal from your own department' });
      }

      const userToRemove = department.users[0];
      if (!userToRemove) {
        return res.status(404).json({ error: 'User not found in this department' });
      }

      // Cannot request removal of yourself
      if (userId === req.user.id) {
        return res.status(400).json({ error: 'You cannot request removal of yourself' });
      }

      // Check if there's already a pending request
      const existingRequest = await prisma.activityLog.findFirst({
        where: {
          action: 'USER_REMOVAL_REQUESTED',
          metadata: {
            path: ['targetUserId'],
            equals: userId
          },
          companyId: req.user.companyId
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingRequest) {
        return res.status(400).json({ error: 'Removal request already pending for this user' });
      }

      // Create removal request activity log
      await prisma.activityLog.create({
        data: {
          action: 'USER_REMOVAL_REQUESTED',
          metadata: {
            targetUserId: userId,
            targetUserEmail: userToRemove.email,
            targetUserName: userToRemove.name,
            departmentId: departmentId,
            departmentName: department.name,
            requestedBy: req.user.name,
            requestedByEmail: req.user.email,
            reason: reason,
            status: 'PENDING'
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({
        message: `Removal request submitted for ${userToRemove.name}. Awaiting super admin approval.`
      });

    } catch (error) {
      console.error('Request user removal error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;