const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticateToken, requireRole, requireSameCompany } = require('../middleware/auth');

// Get company by slug (new slug-based route)
router.get('/slug/:companySlug', 
  authenticateToken,
  requireRole(['SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { companySlug } = req.params;
      console.log('Get company by slug:', companySlug);

      const company = await prisma.company.findUnique({
        where: { slug: companySlug },
        include: {
          departments: {
            select: {
              id: true,
              name: true,
              slug: true,
              _count: {
                select: {
                  users: true,
                  notes: true,
                  tasks: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              users: true,
              departments: true
            }
          }
        }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Check if user belongs to this company
      if (req.user.companyId !== company.id) {
        return res.status(403).json({ error: 'Access denied to this company' });
      }

      res.json({ company });

    } catch (error) {
      console.error('Get company by slug error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get department by company slug and department slug (new slug-based route)
router.get('/slug/:companySlug/:departmentSlug', 
  authenticateToken,
  async (req, res) => {
    try {
      const { companySlug, departmentSlug } = req.params;
      console.log('Get department by slugs:', { companySlug, departmentSlug });

      // First find the company
      const company = await prisma.company.findUnique({
        where: { slug: companySlug }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Check if user belongs to this company
      if (req.user.companyId !== company.id) {
        return res.status(403).json({ error: 'Access denied to this company' });
      }

      // Find the department within the company
      const department = await prisma.department.findFirst({
        where: { 
          slug: departmentSlug,
          companyId: company.id
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true
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

      // Check department access permissions
      if (req.user.role !== 'SUPER_ADMIN' && req.user.departmentId !== department.id) {
        return res.status(403).json({ error: 'Access denied to this department' });
      }

      console.log('Department found successfully');
      res.json({ department });

    } catch (error) {
      console.error('Get department by slugs error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get company details (existing ID-based route)
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