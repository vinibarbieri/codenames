import express from 'express';
import {
  getUserById,
  getUserStats,
  getUserMatches,
  updateUserProfile,
  getRanking,
  getRecentMatches,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/ranking', getRanking);

// Protected routes - must come before /:id routes
router.get('/me/matches/recent', authenticate, getRecentMatches);

// Public routes with params
router.get('/:id', getUserById);
router.get('/:id/stats', getUserStats);
router.get('/:id/matches', getUserMatches);

// Protected routes with params
router.put('/:id', authenticate, updateUserProfile);

export default router;
