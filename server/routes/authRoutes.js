import express from 'express';
import { register, login, verify, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Protected routes
router.get('/verify', authenticate, verify);
router.post('/logout', authenticate, logout);

export default router;
