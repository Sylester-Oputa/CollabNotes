const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { 
  authenticateToken, 
  requireDepartmentAccess 
} = require('../middleware/auth');

// Get notes for a department
router.get('/department/:departmentId', 
  authenticateToken, 
  requireDepartmentAccess, 
  async (req, res) => {
    try {
      const { departmentId } = req.params;
      const { page = 1, limit = 10, search } = req.query;

      const skip = (page - 1) * limit;
      const take = parseInt(limit);

      const where = {
        departmentId,
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } }
          ]
        })
      };

      const [notes, total] = await Promise.all([
        prisma.note.findMany({
          where,
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take
        }),
        prisma.note.count({ where })
      ]);

      res.json({
        notes,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      });

    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get single note
router.get('/:id', 
  authenticateToken, 
  async (req, res) => {
    try {
      const { id } = req.params;

      const note = await prisma.note.findUnique({
        where: { id },
        include: {
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

      if (!note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Check access permissions
      if (req.user.role === 'SUPER_ADMIN') {
        // Super admin can access any note in their company
        if (note.department.companyId !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        // Other users can only access notes in their department
        if (note.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json({ note });

    } catch (error) {
      console.error('Get note error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Create note
router.post('/', 
  authenticateToken,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('content').optional().isString().withMessage('Content must be a string'),
    body('departmentId').notEmpty().withMessage('Department ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, content = '', departmentId } = req.body;

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

      const note = await prisma.note.create({
        data: {
          title,
          content,
          departmentId,
          createdBy: req.user.id
        },
        include: {
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
          action: 'NOTE_CREATED',
          metadata: {
            noteTitle: note.title,
            noteId: note.id
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.status(201).json({
        message: 'Note created successfully',
        note
      });

    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update note
router.put('/:id', 
  authenticateToken,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
    body('content').optional().isString().withMessage('Content must be a string')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { title, content } = req.body;

      // Find note and check permissions
      const existingNote = await prisma.note.findUnique({
        where: { id },
        include: {
          department: true
        }
      });

      if (!existingNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Check access permissions
      if (req.user.role === 'SUPER_ADMIN') {
        if (existingNote.department.companyId !== req.user.companyId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        if (existingNote.departmentId !== req.user.departmentId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;

      const note = await prisma.note.update({
        where: { id },
        data: updateData,
        include: {
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
          action: 'NOTE_UPDATED',
          metadata: {
            noteTitle: note.title,
            noteId: note.id
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({
        message: 'Note updated successfully',
        note
      });

    } catch (error) {
      console.error('Update note error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Delete note
router.delete('/:id', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Find note and check permissions
      const existingNote = await prisma.note.findUnique({
        where: { id },
        include: {
          department: true
        }
      });

      if (!existingNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Check if user can delete (creator, dept admin, or super admin)
      const canDelete = req.user.id === existingNote.createdBy ||
                       req.user.role === 'DEPT_ADMIN' && req.user.departmentId === existingNote.departmentId ||
                       req.user.role === 'SUPER_ADMIN' && req.user.companyId === existingNote.department.companyId;

      if (!canDelete) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.note.delete({
        where: { id }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'NOTE_DELETED',
          metadata: {
            noteTitle: existingNote.title,
            noteId: existingNote.id
          },
          userId: req.user.id,
          companyId: req.user.companyId
        }
      });

      res.json({ message: 'Note deleted successfully' });

    } catch (error) {
      console.error('Delete note error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;