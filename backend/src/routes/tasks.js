const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { 
  authenticateToken, 
  requireDepartmentAccess 
} = require('../middleware/auth');

// Get tasks for a department
router.get('/department/:departmentId', 
  authenticateToken, 
  requireDepartmentAccess, 
  async (req, res) => {
    try {
      const { departmentId } = req.params;
      const { status, assignedTo, page = 1, limit = 20 } = req.query;

      const skip = (page - 1) * limit;
      const take = parseInt(limit);

      const where = {
        departmentId,
        ...(status && { status }),
        ...(assignedTo && { assignedTo })
      };

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            creator: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        prisma.task.count({ where })
      ]);

      res.json({
        tasks,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      });

    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get single task
router.get('/:id', 
  authenticateToken, 
  async (req, res) => {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              companyId: true
            }
          }
        }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Check access permissions
      if (req.user.role === 'SUPER_ADMIN') {
        if (task.department.companyId !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        if (task.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json({ task });

    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Create task
router.post('/', 
  authenticateToken,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('departmentId').notEmpty().withMessage('Department ID required'),
    body('assignedTo').optional().isString().withMessage('Assigned to must be a user ID'),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, departmentId, assignedTo, dueDate, status = 'TODO' } = req.body;

      // Verify department access
      if (req.user.role === 'SUPER_ADMIN') {
        const department = await prisma.department.findFirst({
          where: {
            id: departmentId,
            companyId: req.user.companyId
          }
        });
        if (!department) {
          return res.status(403).json({ error: 'Access denied to this department' });
        }
      } else {
        if (req.user.departmentId !== departmentId) {
          return res.status(403).json({ error: 'Access denied to this department' });
        }
      }

      // Verify assignee if provided
      if (assignedTo) {
        const assignee = await prisma.user.findFirst({
          where: {
            id: assignedTo,
            departmentId: departmentId
          }
        });
        if (!assignee) {
          return res.status(400).json({ error: 'Assignee not found in this department' });
        }
      }

      const task = await prisma.task.create({
        data: {
          title,
          description,
          status,
          departmentId,
          assignedTo,
          createdBy: req.user.id,
          dueDate: dueDate ? new Date(dueDate) : null
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'TASK_CREATED',
          metadata: {
            taskTitle: task.title,
            taskId: task.id,
            assignedToEmail: task.assignee?.email
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.status(201).json({
        message: 'Task created successfully',
        task
      });

    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update task
router.put('/:id', 
  authenticateToken,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('assignedTo').optional().isString().withMessage('Assigned to must be a user ID'),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { title, description, assignedTo, dueDate, status } = req.body;

      // Find task and check permissions
      const existingTask = await prisma.task.findUnique({
        where: { id },
        include: {
          department: true
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Check access permissions
      if (req.user.role === 'SUPER_ADMIN') {
        if (existingTask.department.companyId !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        if (existingTask.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Verify assignee if provided
      if (assignedTo) {
        const assignee = await prisma.user.findFirst({
          where: {
            id: assignedTo,
            departmentId: existingTask.departmentId
          }
        });
        if (!assignee) {
          return res.status(400).json({ error: 'Assignee not found in this department' });
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (status !== undefined) updateData.status = status;

      const task = await prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'TASK_UPDATED',
          metadata: {
            taskTitle: task.title,
            taskId: task.id,
            changes: updateData
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({
        message: 'Task updated successfully',
        task
      });

    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Delete task
router.delete('/:id', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Find task and check permissions
      const existingTask = await prisma.task.findUnique({
        where: { id },
        include: {
          department: true
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Check if user can delete (creator, dept admin, or super admin)
      const canDelete = req.user.id === existingTask.createdBy ||
                       req.user.role === 'DEPT_ADMIN' && req.user.departmentId === existingTask.departmentId ||
                       req.user.role === 'SUPER_ADMIN' && req.user.companyId === existingTask.department.companyId;

      if (!canDelete) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.task.delete({
        where: { id }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'TASK_DELETED',
          metadata: {
            taskTitle: existingTask.title,
            taskId: existingTask.id
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({ message: 'Task deleted successfully' });

    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;