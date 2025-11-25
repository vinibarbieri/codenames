import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import {
  handleStartRecording,
  handleStopRecording,
  handleGetRecording,
  handleStreamRecording,
  handleDeleteRecording,
  handleGetUserRecordings,
  uploadMiddleware,
} from '../controllers/recordingController.js';

const router = express.Router();

// Rate limiter for recording start (max 5 recordings per hour)
const recordingStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message:
      'Too many recording attempts. Please wait before starting a new recording.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/recordings/start
// @desc    Start a new recording
// @access  Private
router.post('/start', authenticate, recordingStartLimiter, handleStartRecording);

// @route   POST /api/recordings/stop
// @desc    Stop recording and upload video
// @access  Private
router.post('/stop', authenticate, uploadMiddleware, handleStopRecording);

// @route   GET /api/recordings/user/me
// @desc    Get current user's recordings
// @access  Private
router.get('/user/me', authenticate, handleGetUserRecordings);

// @route   GET /api/recordings/:id
// @desc    Get recording metadata
// @access  Public
router.get('/:id', handleGetRecording);

// @route   GET /api/recordings/:id/stream
// @desc    Stream recording video
// @access  Public
router.get('/:id/stream', handleStreamRecording);

// @route   DELETE /api/recordings/:id
// @desc    Delete recording
// @access  Private
router.delete('/:id', authenticate, handleDeleteRecording);

export default router;
