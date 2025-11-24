import express from 'express';
import {
  getUserById,
  getUserStats,
  getUserMatches,
  updateUserProfile,
  getRanking,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/ranking', getRanking);
router.get('/:id', getUserById);
router.get('/:id/stats', getUserStats);
router.get('/:id/matches', getUserMatches);

// Protected routes
router.put('/:id', authenticate, updateUserProfile);

export default router;
