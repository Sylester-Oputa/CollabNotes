const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticateToken, requireRole, requireSameCompany } = require('../middleware/auth');

// Get company details
router.get('/:id', authenticateToken, requireSameCompany, async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        departments: {
          include: {
            _count: {
              select: {
                users: true,
                notes: true,
                tasks: true
              }
            }
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });

  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create department
router.post('/:id/departments', 
  authenticateToken, 
  requireSameCompany,
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

      const { id: companyId } = req.params;
      const { name } = req.body;

      // Check if department already exists
      const existingDept = await prisma.department.findFirst({
        where: {
          name,
          companyId
        }
      });

      if (existingDept) {
        return res.status(400).json({ error: 'Department already exists' });
      }

      const department = await prisma.department.create({
        data: {
          name,
          companyId
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          action: 'DEPARTMENT_CREATED',
          metadata: {
            departmentName: department.name,
            departmentId: department.id
          },
          userId: req.user.id,
          companyId
        }
      });

      res.status(201).json({
        message: 'Department created successfully',
        department
      });

    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;