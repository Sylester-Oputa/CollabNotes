const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to ensure USER can only access their own department data
const requireUserDepartmentAccess = async (req, res, next) => {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({ error: 'Only team members can access this resource' });
    }
    
    if (!req.user.departmentId) {
      return res.status(403).json({ error: 'User must be assigned to a department' });
    }
    
    // USER operations are scoped to their department
    req.departmentId = req.user.departmentId;
    req.companyId = req.user.companyId;
    next();
  } catch (error) {
    console.error('User department access middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// USER: Personal Dashboard - Overview of user's work and department
router.get('/dashboard', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const companyId = req.companyId;
    
    console.log(`👤 Fetching personal dashboard for USER: ${req.user.email}, Department: ${departmentId}`);

    // Get user's work summary and department info
    const [
      userProfile,
      department,
      assignedTasks,
      myNotes,
      teamMembers,
      departmentNotes,
      recentActivity
    ] = await Promise.all([
      // User profile with activity counts
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              sentMessages: { where: { deletedAt: null } },
              createdNotes: true,
              createdTasks: true,
              assignedTasks: true
            }
          }
        }
      }),
      
      // Department details
      prisma.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          name: true,
          slug: true,
          company: {
            select: { name: true }
          }
        }
      }),
      
      // Tasks assigned to this user
      prisma.task.findMany({
        where: { 
          assignedTo: userId,
          departmentId
        },
        include: {
          creator: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      
      // Notes created by this user
      prisma.note.findMany({
        where: { 
          createdBy: userId,
          departmentId
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      
      // Team members in the same department
      prisma.user.findMany({
        where: { departmentId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastSeen: true,
          isTyping: true
        },
        orderBy: { name: 'asc' }
      }),
      
      // Recent department notes (not created by this user)
      prisma.note.findMany({
        where: { 
          departmentId,
          createdBy: { not: userId }
        },
        include: {
          creator: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      
      // Recent activity related to user or department
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
        take: 10
      })
    ]);

    if (!userProfile || !department) {
      return res.status(404).json({ error: 'User or department not found' });
    }

    // Calculate task statistics
    const taskStats = {
      total: assignedTasks.length,
      todo: assignedTasks.filter(t => t.status === 'TODO').length,
      inProgress: assignedTasks.filter(t => t.status === 'IN_PROGRESS').length,
      done: assignedTasks.filter(t => t.status === 'DONE').length
    };

    res.json({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        activity: {
          messagesSent: userProfile._count.sentMessages,
          notesCreated: userProfile._count.createdNotes,
          tasksCreated: userProfile._count.createdTasks,
          tasksAssigned: userProfile._count.assignedTasks
        }
      },
      department,
      taskSummary: taskStats,
      assignedTasks: assignedTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        creator: task.creator,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      })),
      myNotes: myNotes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      })),
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        lastSeen: member.lastSeen,
        isOnline: member.lastSeen && (new Date() - new Date(member.lastSeen)) < 5 * 60 * 1000 // 5 minutes
      })),
      departmentNotes: departmentNotes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        creator: note.creator,
        createdAt: note.createdAt
      })),
      recentActivity: recentActivity.map(activity => ({
        id: activity.id,
        action: activity.action,
        user: activity.user,
        metadata: activity.metadata,
        createdAt: activity.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching user dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch user dashboard' });
  }
});

// USER: My Tasks - View and update assigned tasks (read-only for others)
router.get('/my-tasks', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const { 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log(`📋 Fetching assigned tasks for user: ${userId}`);

    // Build filters for user's assigned tasks
    const filters = { 
      assignedTo: userId,
      departmentId
    };
    
    if (status && status !== 'all') {
      filters.status = status;
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const tasks = await prisma.task.findMany({
      where: filters,
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy
    });

    res.json({
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        creator: task.creator,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

// USER: Update My Task Status (users can only update status of tasks assigned to them)
router.put('/my-tasks/:taskId', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const { status } = req.body;

    console.log(`✏️ Updating task status: ${taskId} by user: ${userId}`);

    // Verify task is assigned to this user and in their department
    const existingTask = await prisma.task.findFirst({
      where: { 
        id: taskId, 
        assignedTo: userId,
        departmentId
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or not assigned to you' });
    }

    // Validate status
    const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid task status' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        creator: {
          select: { name: true, email: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'task_status_updated',
        metadata: {
          taskId,
          taskTitle: updatedTask.title,
          oldStatus: existingTask.status,
          newStatus: status,
          departmentId,
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.json({
      message: 'Task status updated successfully',
      task: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        dueDate: updatedTask.dueDate,
        creator: updatedTask.creator,
        updatedAt: updatedTask.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// USER: My Notes - Create and manage personal notes
router.get('/my-notes', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const { 
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters for user's notes
    const filters = { 
      createdBy: userId,
      departmentId
    };
    
    if (search) {
      filters.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where: filters,
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
    console.error('Error fetching user notes:', error);
    res.status(500).json({ error: 'Failed to fetch user notes' });
  }
});

// USER: Create Note
router.post('/my-notes', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const { title, content } = req.body;

    console.log(`📝 Creating note by user: ${userId} in department: ${departmentId}`);

    const note = await prisma.note.create({
      data: {
        title,
        content: content || '',
        createdBy: userId,
        departmentId
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'note_created',
        metadata: {
          noteId: note.id,
          noteTitle: note.title,
          departmentId,
          createdBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.status(201).json({
      message: 'Note created successfully',
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// USER: Update My Note
router.put('/my-notes/:noteId', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const departmentId = req.departmentId;
    const { title, content } = req.body;

    console.log(`📝 Updating note: ${noteId} by user: ${userId}`);

    // Verify note belongs to this user and department
    const existingNote = await prisma.note.findFirst({
      where: { 
        id: noteId, 
        createdBy: userId,
        departmentId
      }
    });

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content })
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'note_updated',
        metadata: {
          noteId,
          noteTitle: updatedNote.title,
          departmentId,
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.json({
      message: 'Note updated successfully',
      note: {
        id: updatedNote.id,
        title: updatedNote.title,
        content: updatedNote.content,
        updatedAt: updatedNote.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// USER: Delete My Note
router.delete('/my-notes/:noteId', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;
    const departmentId = req.departmentId;

    console.log(`🗑️ Deleting note: ${noteId} by user: ${userId}`);

    // Verify note belongs to this user and department
    const note = await prisma.note.findFirst({
      where: { 
        id: noteId, 
        createdBy: userId,
        departmentId
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found or access denied' });
    }

    // Delete the note
    await prisma.note.delete({
      where: { id: noteId }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'note_deleted',
        metadata: {
          noteId,
          noteTitle: note.title,
          departmentId,
          deletedBy: req.user.name
        },
        userId: req.user.id,
        companyId: req.user.companyId
      }
    });

    res.json({
      message: 'Note deleted successfully',
      deletedNote: {
        id: note.id,
        title: note.title
      }
    });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// USER: Department Notes - View all department notes (read-only)
router.get('/department-notes', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
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

    // Build filters for department notes
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
        updatedAt: note.updatedAt,
        isOwner: note.creator.id === req.user.id
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

// USER: Team Members - View department team (read-only)
router.get('/team', authenticateToken, requireRole(['USER']), requireUserDepartmentAccess, async (req, res) => {
  try {
    const departmentId = req.departmentId;

    console.log(`👥 Fetching team members for user in department: ${departmentId}`);

    const teamMembers = await prisma.user.findMany({
      where: { departmentId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentRole: true,
        lastSeen: true,
        isTyping: true,
        createdAt: true
      },
      orderBy: [
        { role: 'asc' }, // DEPT_HEAD first, then USERs
        { name: 'asc' }
      ]
    });

    res.json({
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        departmentRole: member.departmentRole,
        lastSeen: member.lastSeen,
        isOnline: member.lastSeen && (new Date() - new Date(member.lastSeen)) < 5 * 60 * 1000, // 5 minutes
        isCurrentUser: member.id === req.user.id,
        createdAt: member.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

module.exports = router;