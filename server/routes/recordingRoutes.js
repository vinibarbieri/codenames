import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import {
  startRecordingController,
  stopRecordingController,
  getRecording,
  streamRecording,
  deleteRecording,
} from '../controllers/recordingController.js';

const router = express.Router();

// Rate limiting para gravações (max 5 por hora por usuário)
const recordingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: {
    success: false,
    message: 'Too many recording requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/recordings/start
// @desc    Iniciar gravação
// @access  Private
router.post('/start', authenticate, recordingLimiter, startRecordingController);

// @route   POST /api/recordings/stop
// @desc    Parar gravação e salvar
// @access  Private
router.post('/stop', authenticate, recordingLimiter, stopRecordingController);

// @route   GET /api/recordings/:id
// @desc    Obter informações de uma gravação
// @access  Public
router.get('/:id', getRecording);

// @route   GET /api/recordings/:id/stream
// @desc    Stream de vídeo
// @access  Public
router.get('/:id/stream', streamRecording);

// @route   DELETE /api/recordings/:id
// @desc    Deletar gravação
// @access  Private (admin ou dono)
router.delete('/:id', authenticate, deleteRecording);

export default router;

