const express = require('express');
const router = express.Router();

const { 
  registerCompany, 
  login, 
  getProfile, 
  registerValidation, 
  loginValidation 
} = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register-company', registerValidation, registerCompany);
router.post('/login', loginValidation, login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

module.exports = router;