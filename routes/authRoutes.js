// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { check } = require('express-validator');

// POST request for user registration
router.post(
  '/signup', 
  [
    check('email').isEmail().withMessage('Please provide a valid email address'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ], 
  authController.registerUser  // Changed from 'signup' to 'registerUser'
);

// POST request for user login
router.post(
  '/login', 
  [
    check('email').isEmail().withMessage('Please provide a valid email address'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ], 
  authController.loginUser  // Changed from 'login' to 'loginUser'
);

module.exports = router;
