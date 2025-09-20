const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  validateUserCreation,
  validateUserUpdate,
  validateDepartmentCreation,
  validateDepartmentUpdate,
  validateGroupCreation,
  validateGroupUpdate,
  validateCompanySettings,
  validateSecuritySettings,
  validateNotificationSettings,
  validatePagination,
  validateUUIDParam,
  validateTimeframe,
  validateSearch,
  validateSorting
} = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to ensure ADMIN can only access their own company
const requireCompanyOwnership = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only company owners can access this resource' });
    }
    
    // All company admin operations are scoped to the user's company
    req.companyId = req.user.companyId;
    next();
  } catch (error) {
    console.error('Company ownership middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ADMIN: Company Dashboard - Overview of company operations
router.get('/dashboard', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;
    console.log(`📊 Fetching company dashboard for ADMIN: ${req.user.email}, Company: ${companyId}`);

    // Get comprehensive company statistics
    const [
      company,
      totalUsers,
      totalDepartments,
      totalMessages,
      totalNotes,
      totalTasks,
      recentActivity,
      departmentStats,
      userStats
    ] = await Promise.all([
      // Company details
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          createdAt: true
        }
      }),
      
      // Total users in company
      prisma.user.count({
        where: { companyId }
      }),
      
      // Total departments in company
      prisma.department.count({
        where: { companyId }
      }),
      
      // Total messages in company (last 30 days)
      prisma.message.count({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      
      // Total notes in company
      prisma.note.count({
        where: {
          department: { companyId }
        }
      }),
      
      // Total tasks in company
      prisma.task.count({
        where: {
          department: { companyId }
        }
      }),
      
      // Recent activity (last 7 days)
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
        take: 20
      }),
      
      // Department statistics
      prisma.department.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              users: true,
              notes: true,
              tasks: true
            }
          }
        }
      }),
      
      // User statistics by role
      prisma.user.groupBy({
        by: ['role'],
        where: { companyId },
        _count: { role: true }
      })
    ]);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Calculate growth metrics (compare with last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [previousUsers, previousMessages, previousNotes, previousTasks] = await Promise.all([
      prisma.user.count({
        where: {
          companyId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      }),
      prisma.message.count({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      }),
      prisma.note.count({
        where: {
          department: { companyId },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      }),
      prisma.task.count({
        where: {
          department: { companyId },
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      })
    ]);

    // Calculate growth percentages
    const growthMetrics = {
      users: previousUsers > 0 ? ((totalUsers - previousUsers) / previousUsers * 100) : 0,
      messages: previousMessages > 0 ? ((totalMessages - previousMessages) / previousMessages * 100) : 0,
      notes: previousNotes > 0 ? ((totalNotes - previousNotes) / previousNotes * 100) : 0,
      tasks: previousTasks > 0 ? ((totalTasks - previousTasks) / totalTasks * 100) : 0
    };

    // Format role distribution
    const roleDistribution = userStats.reduce((acc, stat) => {
      acc[stat.role] = stat._count.role;
      return acc;
    }, {});

    res.json({
      company,
      overview: {
        totalUsers,
        totalDepartments,
        totalMessages,
        totalNotes,
        totalTasks
      },
      growthMetrics,
      roleDistribution,
      departments: departmentStats.map(dept => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        userCount: dept._count.users,
        noteCount: dept._count.notes,
        taskCount: dept._count.tasks,
        createdAt: dept.createdAt
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
    console.error('Error fetching company dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch company dashboard' });
  }
});

// ADMIN: Department Management - View and manage departments
router.get('/departments', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { includeUsers = 'false', includeStats = 'true' } = req.query;

    console.log(`🏢 Fetching departments for company: ${companyId}`);

    const departments = await prisma.department.findMany({
      where: { companyId },
      include: {
        users: includeUsers === 'true' ? {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentRole: true,
            lastSeen: true,
            createdAt: true
          }
        } : false,
        _count: includeStats === 'true' ? {
          select: {
            users: true,
            notes: true,
            tasks: true
          }
        } : false
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      departments: departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
        users: dept.users || undefined,
        stats: dept._count ? {
          userCount: dept._count.users,
          noteCount: dept._count.notes,
          taskCount: dept._count.tasks
        } : undefined
      }))
    });

  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// ADMIN: User Management - View and manage company users
router.get('/users', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validatePagination, validateSearch, validateSorting, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      department, 
      role,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters
    const filters = { companyId };
    
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (department && department !== 'all') {
      filters.departmentId = department;
    }
    
    if (role && role !== 'all') {
      filters.role = role;
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        include: {
          department: {
            select: { id: true, name: true, slug: true }
          },
          _count: {
            select: {
              sentMessages: { where: { deletedAt: null } },
              createdNotes: true,
              createdTasks: true,
              assignedTasks: true
            }
          }
        },
        orderBy,
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.user.count({ where: filters })
    ]);

    res.json({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentRole: user.departmentRole,
        department: user.department,
        lastSeen: user.lastSeen,
        isTyping: user.isTyping,
        activity: {
          messagesSent: user._count.sentMessages,
          notesCreated: user._count.createdNotes,
          tasksCreated: user._count.createdTasks,
          tasksAssigned: user._count.assignedTasks
        },
        createdAt: user.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ADMIN: Reassign Department Head
router.put('/departments/:departmentId/head', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { newHeadUserId } = req.body;
    const companyId = req.companyId;

    console.log(`👑 Reassigning department head for dept: ${departmentId}, new head: ${newHeadUserId}`);

    // Verify department belongs to company
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId }
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found or access denied' });
    }

    // Verify new head user belongs to company and department
    const newHead = await prisma.user.findFirst({
      where: { 
        id: newHeadUserId, 
        companyId,
        departmentId 
      }
    });

    if (!newHead) {
      return res.status(404).json({ error: 'User not found in specified department' });
    }

    // Update current department heads to regular users
    await prisma.user.updateMany({
      where: { 
        departmentId, 
        role: 'DEPT_HEAD' 
      },
      data: { role: 'USER' }
    });

    // Promote new user to department head
    const updatedUser = await prisma.user.update({
      where: { id: newHeadUserId },
      data: { role: 'DEPT_HEAD' },
      include: {
        department: {
          select: { name: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'department_head_reassigned',
        metadata: {
          departmentId,
          departmentName: department.name,
          newHeadUserId,
          newHeadName: updatedUser.name,
          reassignedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Department head reassigned successfully',
      newHead: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department
      }
    });

  } catch (error) {
    console.error('Error reassigning department head:', error);
    res.status(500).json({ error: 'Failed to reassign department head' });
  }
});

// ADMIN: Delete Department
router.delete('/departments/:departmentId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { force = 'false' } = req.query; // force deletion even with users
    const companyId = req.companyId;

    console.log(`🗑️ Deleting department: ${departmentId}, force: ${force}`);

    // Verify department belongs to company
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
      include: {
        _count: {
          select: { users: true, notes: true, tasks: true }
        }
      }
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found or access denied' });
    }

    // Check if department has users and force is not enabled
    if (department._count.users > 0 && force !== 'true') {
      return res.status(400).json({ 
        error: 'Department has users. Use force=true to delete department and reassign users.',
        userCount: department._count.users,
        noteCount: department._count.notes,
        taskCount: department._count.tasks
      });
    }

    // If force deletion, reassign users to null department
    if (force === 'true' && department._count.users > 0) {
      await prisma.user.updateMany({
        where: { departmentId },
        data: { 
          departmentId: null,
          role: { not: 'ADMIN' } ? 'USER' : undefined // Demote DEPT_HEAD to USER, keep ADMIN
        }
      });
    }

    // Delete department (cascade will handle notes and tasks)
    await prisma.department.delete({
      where: { id: departmentId }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'department_deleted',
        metadata: {
          departmentId,
          departmentName: department.name,
          userCount: department._count.users,
          force: force === 'true',
          deletedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Department deleted successfully',
      deletedDepartment: {
        id: department.id,
        name: department.name,
        userCount: department._count.users,
        noteCount: department._count.notes,
        taskCount: department._count.tasks
      }
    });

  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ADMIN: Delete User Account
router.delete('/users/:userId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const { userId } = req.params;
    const companyId = req.companyId;

    console.log(`🗑️ Deleting user: ${userId} from company: ${companyId}`);

    // Verify user belongs to company and is not another ADMIN
    const userToDelete = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        department: { select: { name: true } },
        _count: {
          select: {
            sentMessages: true,
            createdNotes: true,
            createdTasks: true,
            assignedTasks: true
          }
        }
      }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    // Prevent ADMIN from deleting other ADMINs
    if (userToDelete.role === 'ADMIN' && userToDelete.id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete other company administrators' });
    }

    // Prevent ADMIN from deleting themselves (should use account deletion flow)
    if (userToDelete.id === req.user.id) {
      return res.status(400).json({ error: 'Use account deletion endpoint to delete your own account' });
    }

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id: userId }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'user_deleted',
        metadata: {
          deletedUserId: userId,
          deletedUserName: userToDelete.name,
          deletedUserEmail: userToDelete.email,
          deletedUserRole: userToDelete.role,
          departmentName: userToDelete.department?.name,
          activityCounts: userToDelete._count,
          deletedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        email: userToDelete.email,
        role: userToDelete.role,
        department: userToDelete.department,
        activityCounts: userToDelete._count
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ADMIN: Create New User
router.post('/users', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateUserCreation, async (req, res) => {
  try {
    const { name, email, password, role = 'USER', departmentId } = req.body;
    const companyId = req.companyId;

    console.log(`👤 Creating new user: ${email} for company: ${companyId}`);

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Validate department if provided
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, companyId }
      });

      if (!department) {
        return res.status(400).json({ error: 'Department not found or access denied' });
      }
    }

    // Hash password (in real implementation, use bcrypt)
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role === 'ADMIN' ? 'USER' : role, // Prevent creating ADMIN users
        companyId,
        departmentId: departmentId || null
      },
      include: {
        department: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'user_created',
        metadata: {
          createdUserId: newUser.id,
          createdUserName: newUser.name,
          createdUserEmail: newUser.email,
          createdUserRole: newUser.role,
          departmentId: newUser.departmentId,
          createdBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ADMIN: Update User
router.put('/users/:userId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateUUIDParam('userId'), validateUserUpdate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, departmentId, departmentRole } = req.body;
    const companyId = req.companyId;

    console.log(`📝 Updating user: ${userId}`);

    // Verify user belongs to company
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        department: { select: { name: true } }
      }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found or access denied' });
    }

    // Prevent ADMIN from changing their own role
    if (existingUser.id === req.user.id && role !== existingUser.role) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Validate department if provided
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, companyId }
      });

      if (!department) {
        return res.status(400).json({ error: 'Department not found or access denied' });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && role !== 'ADMIN' && { role }), // Prevent role escalation to ADMIN
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(departmentRole !== undefined && { departmentRole })
      },
      include: {
        department: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'user_updated',
        metadata: {
          updatedUserId: userId,
          updatedUserName: updatedUser.name,
          changes: { name, email, role, departmentId, departmentRole },
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        departmentRole: updatedUser.departmentRole,
        department: updatedUser.department,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ADMIN: Create Department
router.post('/departments', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateDepartmentCreation, async (req, res) => {
  try {
    const { name, slug } = req.body;
    const companyId = req.companyId;

    console.log(`🏢 Creating department: ${name} for company: ${companyId}`);

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Check if department already exists in company
    const existingDepartment = await prisma.department.findFirst({
      where: {
        companyId,
        OR: [
          { name },
          { slug }
        ]
      }
    });

    if (existingDepartment) {
      return res.status(400).json({ error: 'Department with this name or slug already exists' });
    }

    // Create department
    const newDepartment = await prisma.department.create({
      data: {
        name,
        slug,
        companyId
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

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'department_created',
        metadata: {
          departmentId: newDepartment.id,
          departmentName: newDepartment.name,
          departmentSlug: newDepartment.slug,
          createdBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.status(201).json({
      message: 'Department created successfully',
      department: {
        id: newDepartment.id,
        name: newDepartment.name,
        slug: newDepartment.slug,
        stats: {
          userCount: newDepartment._count.users,
          noteCount: newDepartment._count.notes,
          taskCount: newDepartment._count.tasks
        },
        createdAt: newDepartment.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// ADMIN: Update Department
router.put('/departments/:departmentId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateUUIDParam('departmentId'), validateDepartmentUpdate, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { name, slug } = req.body;
    const companyId = req.companyId;

    console.log(`📝 Updating department: ${departmentId}`);

    // Verify department belongs to company
    const existingDepartment = await prisma.department.findFirst({
      where: { id: departmentId, companyId }
    });

    if (!existingDepartment) {
      return res.status(404).json({ error: 'Department not found or access denied' });
    }

    // Check for conflicts if name or slug is being changed
    if (name !== existingDepartment.name || slug !== existingDepartment.slug) {
      const conflictingDepartment = await prisma.department.findFirst({
        where: {
          companyId,
          id: { not: departmentId },
          OR: [
            ...(name ? [{ name }] : []),
            ...(slug ? [{ slug }] : [])
          ]
        }
      });

      if (conflictingDepartment) {
        return res.status(400).json({ error: 'Department with this name or slug already exists' });
      }
    }

    // Update department
    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(name && { name }),
        ...(slug && { slug })
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

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'department_updated',
        metadata: {
          departmentId,
          changes: { name, slug },
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Department updated successfully',
      department: {
        id: updatedDepartment.id,
        name: updatedDepartment.name,
        slug: updatedDepartment.slug,
        stats: {
          userCount: updatedDepartment._count.users,
          noteCount: updatedDepartment._count.notes,
          taskCount: updatedDepartment._count.tasks
        },
        updatedAt: updatedDepartment.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// ================================
// COMMUNICATION SUITE ENDPOINTS
// ================================

// ADMIN: Get Communication Analytics
router.get('/communications/analytics', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateTimeframe, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { timeframe = '30' } = req.query; // days
    const days = parseInt(timeframe);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    console.log(`📊 Fetching communication analytics for company: ${companyId}, timeframe: ${days} days`);

    const [
      totalMessages,
      totalGroups,
      activeUsers,
      messagesByType,
      groupStats,
      userEngagement,
      messageTimeline
    ] = await Promise.all([
      // Total messages in timeframe
      prisma.message.count({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: startDate }
        }
      }),

      // Total groups
      prisma.messageGroup.count({
        where: { companyId }
      }),

      // Active users (sent messages in timeframe)
      prisma.user.count({
        where: {
          companyId,
          sentMessages: {
            some: {
              deletedAt: null,
              createdAt: { gte: startDate }
            }
          }
        }
      }),

      // Messages by type
      prisma.message.groupBy({
        by: ['type'],
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: startDate }
        },
        _count: { type: true }
      }),

      // Group statistics
      prisma.messageGroup.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              members: true,
              messages: {
                where: {
                  deletedAt: null,
                  createdAt: { gte: startDate }
                }
              }
            }
          }
        },
        orderBy: {
          messages: {
            _count: 'desc'
          }
        },
        take: 10
      }),

      // User engagement stats
      prisma.user.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              sentMessages: {
                where: {
                  deletedAt: null,
                  createdAt: { gte: startDate }
                }
              }
            }
          }
        },
        orderBy: {
          sentMessages: {
            _count: 'desc'
          }
        },
        take: 10
      }),

      // Message timeline (daily breakdown)
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM messages 
        WHERE company_id = ${companyId}
          AND deleted_at IS NULL
          AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ]);

    // Calculate engagement metrics
    const totalUsers = await prisma.user.count({ where: { companyId } });
    const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers * 100) : 0;

    // Calculate average response time (mock for now)
    const avgResponseTime = '2.5 minutes';

    res.json({
      analytics: {
        totalMessages,
        totalGroups,
        activeUsers,
        totalUsers,
        engagementRate: Math.round(engagementRate * 10) / 10,
        avgResponseTime
      },
      messagesByType: messagesByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {}),
      topGroups: groupStats.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        memberCount: group._count.members,
        messageCount: group._count.messages,
        createdAt: group.createdAt
      })),
      topUsers: userEngagement.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        messageCount: user._count.sentMessages
      })),
      timeline: messageTimeline
    });

  } catch (error) {
    console.error('Error fetching communication analytics:', error);
    res.status(500).json({ error: 'Failed to fetch communication analytics' });
  }
});

// ADMIN: Get Message Groups
router.get('/communications/groups', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validatePagination, validateSearch, validateSorting, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      type,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters
    const filters = { companyId };
    
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (type && type !== 'all') {
      filters.type = type;
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [groups, total] = await Promise.all([
      prisma.messageGroup.findMany({
        where: filters,
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              members: true,
              messages: {
                where: { deletedAt: null }
              }
            }
          }
        },
        orderBy,
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.messageGroup.count({ where: filters })
    ]);

    res.json({
      groups: groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        type: group.type,
        creator: group.creator,
        memberCount: group._count.members,
        messageCount: group._count.messages,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching message groups:', error);
    res.status(500).json({ error: 'Failed to fetch message groups' });
  }
});

// ADMIN: Create Message Group
router.post('/communications/groups', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateGroupCreation, async (req, res) => {
  try {
    const { name, description, type = 'CUSTOM' } = req.body;
    const companyId = req.companyId;

    console.log(`💬 Creating message group: ${name} for company: ${companyId}`);

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Check if group already exists
    const existingGroup = await prisma.messageGroup.findFirst({
      where: { companyId, name }
    });

    if (existingGroup) {
      return res.status(400).json({ error: 'Group with this name already exists' });
    }

    // Create group
    const newGroup = await prisma.messageGroup.create({
      data: {
        name,
        description,
        type,
        companyId,
        createdBy: req.user.id
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    });

    // Add creator as admin member
    await prisma.groupMembership.create({
      data: {
        groupId: newGroup.id,
        userId: req.user.id,
        role: 'ADMIN'
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'message_group_created',
        metadata: {
          groupId: newGroup.id,
          groupName: newGroup.name,
          groupType: newGroup.type,
          createdBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.status(201).json({
      message: 'Message group created successfully',
      group: {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        type: newGroup.type,
        creator: newGroup.creator,
        memberCount: newGroup._count.members + 1, // Include creator
        messageCount: newGroup._count.messages,
        createdAt: newGroup.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating message group:', error);
    res.status(500).json({ error: 'Failed to create message group' });
  }
});

// ADMIN: Update Message Group
router.put('/communications/groups/:groupId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateUUIDParam('groupId'), validateGroupUpdate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, type } = req.body;
    const companyId = req.companyId;

    console.log(`📝 Updating message group: ${groupId}`);

    // Verify group belongs to company
    const existingGroup = await prisma.messageGroup.findFirst({
      where: { id: groupId, companyId }
    });

    if (!existingGroup) {
      return res.status(404).json({ error: 'Message group not found or access denied' });
    }

    // Check for name conflicts if name is being changed
    if (name && name !== existingGroup.name) {
      const conflictingGroup = await prisma.messageGroup.findFirst({
        where: {
          companyId,
          id: { not: groupId },
          name
        }
      });

      if (conflictingGroup) {
        return res.status(400).json({ error: 'Group with this name already exists' });
      }
    }

    // Update group
    const updatedGroup = await prisma.messageGroup.update({
      where: { id: groupId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type })
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: {
            members: true,
            messages: { where: { deletedAt: null } }
          }
        }
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'message_group_updated',
        metadata: {
          groupId,
          changes: { name, description, type },
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Message group updated successfully',
      group: {
        id: updatedGroup.id,
        name: updatedGroup.name,
        description: updatedGroup.description,
        type: updatedGroup.type,
        creator: updatedGroup.creator,
        memberCount: updatedGroup._count.members,
        messageCount: updatedGroup._count.messages,
        updatedAt: updatedGroup.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating message group:', error);
    res.status(500).json({ error: 'Failed to update message group' });
  }
});

// ADMIN: Delete Message Group
router.delete('/communications/groups/:groupId', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const { groupId } = req.params;
    const companyId = req.companyId;

    console.log(`🗑️ Deleting message group: ${groupId}`);

    // Verify group belongs to company
    const existingGroup = await prisma.messageGroup.findFirst({
      where: { id: groupId, companyId },
      include: {
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    });

    if (!existingGroup) {
      return res.status(404).json({ error: 'Message group not found or access denied' });
    }

    // Delete group (cascade will handle members and messages)
    await prisma.messageGroup.delete({
      where: { id: groupId }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'message_group_deleted',
        metadata: {
          groupId,
          groupName: existingGroup.name,
          memberCount: existingGroup._count.members,
          messageCount: existingGroup._count.messages,
          deletedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Message group deleted successfully',
      deletedGroup: {
        id: existingGroup.id,
        name: existingGroup.name,
        memberCount: existingGroup._count.members,
        messageCount: existingGroup._count.messages
      }
    });

  } catch (error) {
    console.error('Error deleting message group:', error);
    res.status(500).json({ error: 'Failed to delete message group' });
  }
});

// ================================
// SETTINGS & SECURITY ENDPOINTS
// ================================

// ADMIN: Get Company Settings
router.get('/settings', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;

    console.log(`⚙️ Fetching company settings for: ${companyId}`);

    // Get company information
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get security configurations (mock for now - in real implementation, 
    // you'd have a CompanySettings model)
    const settings = {
      company: {
        name: company.name,
        email: company.email,
        website: '', // Would come from company settings table
        industry: '', // Would come from company settings table
        description: '' // Would come from company settings table
      },
      security: {
        twoFactorEnabled: false, // Would query actual settings
        passwordPolicy: 'medium', // Would query actual settings
        sessionTimeout: 60, // Would query actual settings
        loginAttempts: 5 // Would query actual settings
      },
      notifications: {
        emailEnabled: true, // Would query actual settings
        pushEnabled: true, // Would query actual settings
        digestFrequency: 'daily' // Would query actual settings
      },
      system: {
        apiKeysEnabled: false, // Would query actual settings
        auditLogging: true, // Would query actual settings
        dataRetention: 365 // Would query actual settings
      }
    };

    res.json({
      settings,
      lastUpdated: company.updatedAt
    });

  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// ADMIN: Update Company Information
router.put('/settings/company', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateCompanySettings, async (req, res) => {
  try {
    const { name, email, website, industry, description } = req.body;
    const companyId = req.companyId;

    console.log(`🏢 Updating company information for: ${companyId}`);

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Company name and email are required' });
    }

    // Check for email conflicts
    if (email) {
      const existingCompany = await prisma.company.findFirst({
        where: {
          email,
          id: { not: companyId }
        }
      });

      if (existingCompany) {
        return res.status(400).json({ error: 'Company with this email already exists' });
      }
    }

    // Update company
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        email
        // In real implementation, you'd update additional fields
        // website, industry, description would go to a CompanySettings table
      }
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'company_settings_updated',
        metadata: {
          section: 'company_information',
          changes: { name, email, website, industry, description },
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Company information updated successfully',
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        email: updatedCompany.email,
        updatedAt: updatedCompany.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating company information:', error);
    res.status(500).json({ error: 'Failed to update company information' });
  }
});

// ADMIN: Update Security Settings
router.put('/settings/security', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateSecuritySettings, async (req, res) => {
  try {
    const { 
      twoFactorEnabled, 
      passwordPolicy, 
      sessionTimeout, 
      loginAttempts 
    } = req.body;
    const companyId = req.companyId;

    console.log(`🔒 Updating security settings for company: ${companyId}`);

    // Validate settings
    if (sessionTimeout && (sessionTimeout < 5 || sessionTimeout > 480)) {
      return res.status(400).json({ error: 'Session timeout must be between 5 and 480 minutes' });
    }

    if (passwordPolicy && !['low', 'medium', 'high'].includes(passwordPolicy)) {
      return res.status(400).json({ error: 'Invalid password policy' });
    }

    // In real implementation, you'd update these in a CompanySettings table
    // For now, we'll just log the changes
    const settings = {
      twoFactorEnabled,
      passwordPolicy,
      sessionTimeout,
      loginAttempts
    };

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'security_settings_updated',
        metadata: {
          section: 'security',
          changes: settings,
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Security settings updated successfully',
      settings: settings
    });

  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

// ADMIN: Update Notification Settings
router.put('/settings/notifications', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, validateNotificationSettings, async (req, res) => {
  try {
    const { 
      emailEnabled, 
      pushEnabled, 
      digestFrequency 
    } = req.body;
    const companyId = req.companyId;

    console.log(`🔔 Updating notification settings for company: ${companyId}`);

    // Validate settings
    if (digestFrequency && !['never', 'daily', 'weekly', 'monthly'].includes(digestFrequency)) {
      return res.status(400).json({ error: 'Invalid digest frequency' });
    }

    // In real implementation, you'd update these in a CompanySettings table
    const settings = {
      emailEnabled,
      pushEnabled,
      digestFrequency
    };

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'notification_settings_updated',
        metadata: {
          section: 'notifications',
          changes: settings,
          updatedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Notification settings updated successfully',
      settings: settings
    });

  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// ADMIN: Export Company Data
router.post('/settings/export', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { format = 'json', includeData = [] } = req.body;

    console.log(`📁 Exporting company data for: ${companyId}, format: ${format}`);

    // In real implementation, this would:
    // 1. Create a background job to export data
    // 2. Generate files with company data
    // 3. Send email with download link
    // 4. Return job ID for status tracking

    // For now, return mock response
    const exportJob = {
      id: `export_${Date.now()}`,
      status: 'initiated',
      format,
      includeData,
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      downloadUrl: null
    };

    // Log the action
    await prisma.activityLog.create({
      data: {
        action: 'data_export_requested',
        metadata: {
          exportJobId: exportJob.id,
          format,
          includeData,
          requestedBy: req.user.name
        },
        userId: req.user.id,
        companyId
      }
    });

    res.json({
      message: 'Data export initiated successfully',
      export: exportJob
    });

  } catch (error) {
    console.error('Error initiating data export:', error);
    res.status(500).json({ error: 'Failed to initiate data export' });
  }
});

// ADMIN: Get System Logs
router.get('/settings/logs', authenticateToken, requireRole(['ADMIN']), requireCompanyOwnership, async (req, res) => {
  try {
    const companyId = req.companyId;
    const { 
      page = 1, 
      limit = 50, 
      level = 'all',
      startDate,
      endDate
    } = req.query;
    
    const offset = (page - 1) * limit;

    // Build filters
    const filters = { companyId };
    
    if (level !== 'all') {
      filters.action = { contains: level, mode: 'insensitive' };
    }
    
    if (startDate) {
      filters.createdAt = { gte: new Date(startDate) };
    }
    
    if (endDate) {
      filters.createdAt = { 
        ...filters.createdAt,
        lte: new Date(endDate) 
      };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: filters,
        include: {
          user: {
            select: { name: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.activityLog.count({ where: filters })
    ]);

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        user: log.user,
        metadata: log.metadata,
        timestamp: log.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

module.exports = router;