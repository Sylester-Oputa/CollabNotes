const express = require('express');
const router = express.Router();

const { 
  registerCompany, 
  login, 
  getProfile,
  registerDepartmentUser,
  registerDepartmentHead,
  getDepartmentSignupInfo,
  registerValidation, 
  loginValidation 
} = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register-company', registerValidation, registerCompany);
router.post('/login', loginValidation, login);

// Department signup routes
router.get('/department/:departmentId/signup-info', getDepartmentSignupInfo);
router.post('/department/:departmentId/signup', registerDepartmentUser);
router.post('/department/:departmentId/signup-head', registerDepartmentHead);

// Slug-based department signup routes
router.get('/company/:companySlug/department/:departmentSlug/signup-info', getDepartmentSignupInfo);
router.post('/company/:companySlug/department/:departmentSlug/signup', registerDepartmentUser);
router.post('/company/:companySlug/department/:departmentSlug/signup-head', registerDepartmentHead);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

module.exports = router;