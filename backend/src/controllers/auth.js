const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const registerCompany = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { companyName, companyEmail, adminName, adminEmail, password } = req.body;

    // Check if company already exists
    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [
          { name: companyName },
          { email: companyEmail }
        ]
      }
    });

    if (existingCompany) {
      return res.status(400).json({ error: 'Company name or email already exists' });
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Admin email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create company and super admin in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: companyName,
          email: companyEmail
        }
      });

      // Create super admin user
      const admin = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: 'SUPER_ADMIN',
          companyId: company.id
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          action: 'COMPANY_REGISTERED',
          metadata: {
            companyName: company.name,
            adminEmail: admin.email
          },
          userId: admin.id,
          companyId: company.id
        }
      });

      return { company, admin };
    });

    // Generate token
    const token = generateToken(result.admin.id);

    res.status(201).json({
      message: 'Company registered successfully',
      token,
      user: {
        id: result.admin.id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role,
        company: {
          id: result.company.id,
          name: result.company.name
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user with company and department details
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        company: true,
        department: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'USER_LOGIN',
        metadata: {
          email: user.email,
          role: user.role
        },
        userId: user.id,
        companyId: user.companyId
      }
    });

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        company: true,
        department: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const registerDepartmentUser = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { departmentId } = req.params;
    const { name, email, password, departmentRole } = req.body;

    // Validate that departmentRole is provided
    if (!departmentRole || departmentRole.trim() === '') {
      return res.status(400).json({ error: 'Department role is required' });
    }

    // Verify department exists and get company info
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        company: true
      }
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found or signup link invalid' });
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

    // Create user in the department
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'USER', // Always USER role for department signup
        departmentRole: departmentRole?.trim() || null, // Custom role within department
        companyId: department.companyId,
        departmentId: department.id
      },
      include: {
        company: true,
        department: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'USER_REGISTERED_VIA_DEPARTMENT_LINK',
        metadata: {
          userEmail: user.email,
          departmentName: department.name,
          companyName: department.company.name
        },
        userId: user.id,
        companyId: user.companyId
      }
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Department user registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// Separate endpoint for department head registration
const registerDepartmentHead = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { departmentId } = req.params;
    const { name, email, password } = req.body;

    // Verify department exists and get company info
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        company: true,
        users: {
          where: { role: 'HEAD_OF_DEPARTMENT' }
        }
      }
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found or signup link invalid' });
    }

    // Check if department already has a head
    if (department.users.length > 0) {
      return res.status(400).json({ error: 'Department already has a head assigned' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user as department head
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'HEAD_OF_DEPARTMENT',
        departmentRole: 'Head of Department', // Default role title for head
        companyId: department.companyId,
        departmentId: department.id
      },
      include: {
        company: true,
        department: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'DEPARTMENT_HEAD_REGISTERED',
        metadata: {
          userEmail: user.email,
          departmentName: department.name,
          companyName: department.company.name
        },
        userId: user.id,
        companyId: user.companyId
      }
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Department head account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        department: user.department
      }
    });

  } catch (error) {
    console.error('Department head registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const getDepartmentSignupInfo = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({
      department: {
        id: department.id,
        name: department.name,
        company: department.company
      }
    });

  } catch (error) {
    console.error('Get department signup info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const registerValidation = [
  body('companyName').trim().isLength({ min: 2, max: 100 }).withMessage('Company name must be 2-100 characters'),
  body('companyEmail').isEmail().normalizeEmail().withMessage('Valid company email required'),
  body('adminName').trim().isLength({ min: 2, max: 50 }).withMessage('Admin name must be 2-50 characters'),
  body('adminEmail').isEmail().normalizeEmail().withMessage('Valid admin email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

module.exports = {
  registerCompany,
  login,
  getProfile,
  registerDepartmentUser,
  registerDepartmentHead,
  getDepartmentSignupInfo,
  registerValidation,
  loginValidation
};