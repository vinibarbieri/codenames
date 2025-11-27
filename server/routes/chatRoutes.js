import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getChatHistory } from '../controllers/chatController.js';

const router = express.Router();

// @route   GET /api/chat/history
// @desc    Get chat history
// @access  Private
router.get('/history', authenticate, getChatHistory);

export default router;

