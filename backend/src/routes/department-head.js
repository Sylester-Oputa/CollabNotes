const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to ensure DEPT_HEAD can only access their own department
const requireDepartmentOwnership = async (req, res, next) => {
  try {
    if (req.user.role !== 'DEPT_HEAD') {
      return res.status(403).json({ error: 'Only department heads can access this resource' });
    }
    
    if (!req.user.departmentId) {
      return res.status(403).json({ error: 'Department head must be assigned to a department' });
    }
    
    // All department operations are scoped to the user's department
    req.departmentId = req.user.departmentId;
    req.companyId = req.user.companyId;
    next();
  } catch (error) {
    console.error('Department ownership middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// DEPT_HEAD: Department Dashboard - Overview of department operations
router.get('/dashboard', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const departmentId = req.departmentId;
    const companyId = req.companyId;
    
    console.log(`🏢 Fetching department dashboard for DEPT_HEAD: ${req.user.email}, Department: ${departmentId}`);

    // Get comprehensive department statistics
    const [
      department,
      totalUsers,
      totalNotes,
      totalTasks,
      completedTasks,
      recentActivity,
      teamMembers,
      taskStatusDistribution,
      notesByUser
    ] = await Promise.all([
      // Department details
      prisma.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          company: {
            select: { name: true, id: true }
          }
        }
      }),
      
      // Total users in department
      prisma.user.count({
        where: { departmentId }
      }),
      
      // Total notes in department
      prisma.note.count({
        where: { departmentId }
      }),
      
      // Total tasks in department
      prisma.task.count({
        where: { departmentId }
      }),
      
      // Completed tasks in department
      prisma.task.count({
        where: {
          departmentId,
          status: 'DONE'
        }
      }),
      
      // Recent activity in department (last 7 days)
      prisma.activityLog.findMany({
        where: {
          companyId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        include: {
          user: {
            select: { name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 15
      }),
      
      // Team members with their activity
      prisma.user.findMany({
        where: { departmentId },
        include: {
          _count: {
            select: {
              sentMessages: { where: { deletedAt: null } },
              createdNotes: true,
              createdTasks: true,
              assignedTasks: { where: { status: { not: 'DONE' } } }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      
      // Task status distribution
      prisma.task.groupBy({
        by: ['status'],
        where: { departmentId },
        _count: { status: true }
      }),
      
      // Notes by user
      prisma.user.findMany({
        where: { departmentId },
        include: {
          _count: {
            select: {
              createdNotes: true
            }
          }
        }
      })
    ]);

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Calculate productivity metrics
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0;
    
    // Format task status distribution
    const taskStats = taskStatusDistribution.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, { TODO: 0, IN_PROGRESS: 0, DONE: 0 });

    // Calculate average notes per user
    const avgNotesPerUser = totalUsers > 0 ? (totalNotes / totalUsers) : 0;

    res.json({
      department,
      overview: {
        totalUsers,
        totalNotes,
        totalTasks,
        completedTasks,
        taskCompletionRate: Math.round(taskCompletionRate * 100) / 100,
        avgNotesPerUser: Math.round(avgNotesPerUser * 100) / 100
      },
      taskStats,
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        lastSeen: member.lastSeen,
        isTyping: member.isTyping,
        activity: {
          messagesSent: member._count.sentMessages,
          notesCreated: member._count.createdNotes,
          tasksCreated: member._count.createdTasks,
          activeTasks: member._count.assignedTasks
        },
        createdAt: member.createdAt
      })),
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        action: activity.action,
        user: activity.user,
        metadata: activity.metadata,
        createdAt: activity.createdAt
      })),
      notesByUser: notesByUser.map(user => ({
        userId: user.id,
        userName: user.name,
        noteCount: user._count.createdNotes
      }))
    });

  } catch (error) {
    console.error('Error fetching department dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch department dashboard' });
  }
});

// DEPT_HEAD: Team Management - View and manage department team members
router.get('/team', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const departmentId = req.departmentId;
    const { 
      includeActivity = 'true',
      sortBy = 'createdAt',
      sortOrder = 'asc'
    } = req.query;

    console.log(`👥 Fetching team members for department: ${departmentId}`);

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const teamMembers = await prisma.user.findMany({
      where: { departmentId },
      include: {
        _count: includeActivity === 'true' ? {
          select: {
            sentMessages: { where: { deletedAt: null } },
            createdNotes: true,
            createdTasks: true,
            assignedTasks: true,
            assignedTasks: { where: { status: { not: 'DONE' } } }
          }
        } : false
      },
      orderBy
    });

    res.json({
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        departmentRole: member.departmentRole,
        lastSeen: member.lastSeen,
        isTyping: member.isTyping,
        activity: member._count ? {
          messagesSent: member._count.sentMessages,
          notesCreated: member._count.createdNotes,
          tasksCreated: member._count.createdTasks,
          tasksAssigned: member._count.assignedTasks,
          activeTasks: member._count.activeTasks || 0
        } : undefined,
        createdAt: member.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// DEPT_HEAD: Task Management - View and manage department tasks
router.get('/tasks', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const departmentId = req.departmentId;
    const { 
      page = 1, 
      limit = 20, 
      status,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters
    const filters = { departmentId };
    
    if (status && status !== 'all') {
      filters.status = status;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      filters.assignedTo = assignedTo;
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: filters,
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          assignee: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy,
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.task.count({ where: filters })
    ]);

    res.json({
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        creator: task.creator,
        assignee: task.assignee,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching department tasks:', error);
    res.status(500).json({ error: 'Failed to fetch department tasks' });
  }
});

// DEPT_HEAD: Create Task
router.post('/tasks', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const departmentId = req.departmentId;
    const { title, description, assignedTo, dueDate } = req.body;

    console.log(`📝 Creating task in department: ${departmentId}`);

    // Validate assigned user is in the same department
    if (assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedTo, departmentId }
      });

      if (!assignee) {
        return res.status(400).json({ error: 'Cannot assign task to user outside of department' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        departmentId,
        createdBy: req.user.id,
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        creator: {
          select: { name: true, email: true }
        },
        assignee: {
          select: { name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'task_created',
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          departmentId,
          assignedTo: assignedTo || null,
          createdBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.status(201).json({
      message: 'Task created successfully',
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        creator: task.creator,
        assignee: task.assignee,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// DEPT_HEAD: Update Task
router.put('/tasks/:taskId', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const departmentId = req.departmentId;
    const { title, description, status, assignedTo, dueDate } = req.body;

    console.log(`📝 Updating task: ${taskId} in department: ${departmentId}`);

    // Verify task belongs to department
    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, departmentId }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Validate assigned user is in the same department
    if (assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedTo, departmentId }
      });

      if (!assignee) {
        return res.status(400).json({ error: 'Cannot assign task to user outside of department' });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null })
      },
      include: {
        creator: {
          select: { name: true, email: true }
        },
        assignee: {
          select: { name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'task_updated',
        metadata: {
          taskId,
          taskTitle: updatedTask.title,
          departmentId,
          changes: { title, description, status, assignedTo, dueDate },
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.json({
      message: 'Task updated successfully',
      task: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        dueDate: updatedTask.dueDate,
        creator: updatedTask.creator,
        assignee: updatedTask.assignee,
        updatedAt: updatedTask.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DEPT_HEAD: Notes Management - View department notes
router.get('/notes', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const departmentId = req.departmentId;
    const { 
      page = 1, 
      limit = 20, 
      search,
      createdBy,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters
    const filters = { departmentId };
    
    if (search) {
      filters.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (createdBy && createdBy !== 'all') {
      filters.createdBy = createdBy;
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where: filters,
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy,
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.note.count({ where: filters })
    ]);

    res.json({
      notes: notes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        creator: note.creator,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching department notes:', error);
    res.status(500).json({ error: 'Failed to fetch department notes' });
  }
});

// DEPT_HEAD: Delete Task (department head can delete any task in their department)
router.delete('/tasks/:taskId', authenticateToken, requireRole(['DEPT_HEAD']), requireDepartmentOwnership, async (req, res) => {
  try {
    const { taskId } = req.params;
    const departmentId = req.departmentId;

    console.log(`🗑️ Deleting task: ${taskId} from department: ${departmentId}`);

    // Verify task belongs to department
    const task = await prisma.task.findFirst({
      where: { id: taskId, departmentId },
      include: {
        creator: { select: { name: true } },
        assignee: { select: { name: true } }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Delete the task
    await prisma.task.delete({
      where: { id: taskId }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'task_deleted',
        metadata: {
          taskId,
          taskTitle: task.title,
          departmentId,
          creatorName: task.creator.name,
          assigneeName: task.assignee?.name,
          deletedBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.json({
      message: 'Task deleted successfully',
      deletedTask: {
        id: task.id,
        title: task.title,
        creator: task.creator,
        assignee: task.assignee
      }
    });

  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;