const { body, query, param, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// User validation rules
const validateUserCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .optional()
    .isIn(['USER', 'DEPT_HEAD'])
    .withMessage('Role must be USER or DEPT_HEAD'),
  body('departmentId')
    .optional()
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),
  handleValidationErrors
];

const validateUserUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('role')
    .optional()
    .isIn(['USER', 'DEPT_HEAD'])
    .withMessage('Role must be USER or DEPT_HEAD'),
  body('departmentId')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
        return true;
      }
      throw new Error('Department ID must be a valid UUID or null');
    }),
  body('departmentRole')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Department role must be 100 characters or less'),
  handleValidationErrors
];

// Department validation rules
const validateDepartmentCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  body('slug')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department slug must be between 2 and 100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Department slug must contain only lowercase letters, numbers, and hyphens'),
  handleValidationErrors
];

const validateDepartmentUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  body('slug')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department slug must be between 2 and 100 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Department slug must contain only lowercase letters, numbers, and hyphens'),
  handleValidationErrors
];

// Message Group validation rules
const validateGroupCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Group description must be 500 characters or less'),
  body('type')
    .optional()
    .isIn(['DEPARTMENT', 'PROJECT', 'CUSTOM'])
    .withMessage('Group type must be DEPARTMENT, PROJECT, or CUSTOM'),
  handleValidationErrors
];

const validateGroupUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Group name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Group description must be 500 characters or less'),
  body('type')
    .optional()
    .isIn(['DEPARTMENT', 'PROJECT', 'CUSTOM'])
    .withMessage('Group type must be DEPARTMENT, PROJECT, or CUSTOM'),
  handleValidationErrors
];

// Settings validation rules
const validateCompanySettings = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Company name must be between 2 and 200 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Valid website URL is required'),
  body('industry')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Industry must be 100 characters or less'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),
  handleValidationErrors
];

const validateSecuritySettings = [
  body('twoFactorEnabled')
    .optional()
    .isBoolean()
    .withMessage('Two factor enabled must be a boolean'),
  body('passwordPolicy')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Password policy must be low, medium, or high'),
  body('sessionTimeout')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Session timeout must be between 5 and 480 minutes'),
  body('loginAttempts')
    .optional()
    .isInt({ min: 3, max: 10 })
    .withMessage('Login attempts must be between 3 and 10'),
  handleValidationErrors
];

const validateNotificationSettings = [
  body('emailEnabled')
    .optional()
    .isBoolean()
    .withMessage('Email enabled must be a boolean'),
  body('pushEnabled')
    .optional()
    .isBoolean()
    .withMessage('Push enabled must be a boolean'),
  body('digestFrequency')
    .optional()
    .isIn(['never', 'daily', 'weekly', 'monthly'])
    .withMessage('Digest frequency must be never, daily, weekly, or monthly'),
  handleValidationErrors
];

// Query parameter validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

const validateUUIDParam = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),
  handleValidationErrors
];

const validateTimeframe = [
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be between 1 and 365 days'),
  handleValidationErrors
];

const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  handleValidationErrors
];

const validateSorting = [
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'email'])
    .withMessage('Sort by must be createdAt, updatedAt, name, or email'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
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
};