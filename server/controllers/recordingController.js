import multer from 'multer';
import Recording from '../models/Recording.js';
import Game from '../models/Game.js';
import {
  startRecording,
  stopRecording,
  getActiveRecording,
} from '../services/recordingService.js';
import { downloadFromGridFS, deleteFromGridFS } from '../utils/gridfs.js';

// Configurar multer para upload de arquivos em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas vídeos webm
    if (file.mimetype === 'video/webm' || file.originalname.endsWith('.webm')) {
      cb(null, true);
    } else {
      cb(new Error('Only WebM video files are allowed'), false);
    }
  },
});

// @desc    Iniciar gravação
// @route   POST /api/recordings/start
// @access  Private
export const startRecordingController = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gameId, settings } = req.body;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID is required',
      });
    }

    // Verificar se o jogo existe e está ativo
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    if (game.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active',
      });
    }

    // Verificar se o usuário está no jogo
    const isPlayer = game.players.some(
      (p) => p.userId.toString() === userId.toString()
    );
    if (!isPlayer) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this game',
      });
    }

    // Iniciar gravação
    const { recordingId } = await startRecording(userId, gameId, settings);

    res.status(200).json({
      success: true,
      data: {
        recordingId,
      },
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start recording',
    });
  }
};

// @desc    Parar gravação e salvar
// @route   POST /api/recordings/stop
// @access  Private
export const stopRecordingController = [
  upload.single('video'),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { recordingId } = req.body;

      if (!recordingId) {
        return res.status(400).json({
          success: false,
          message: 'Recording ID is required',
        });
      }

      // Verificar se a gravação existe e pertence ao usuário
      const recordingData = getActiveRecording(recordingId);
      if (!recordingData) {
        return res.status(404).json({
          success: false,
          message: 'Recording not found or already stopped',
        });
      }

      if (recordingData.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to stop this recording',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Video file is required',
        });
      }

      // Calcular duração (aproximada, baseada no tamanho do arquivo)
      // Em produção, usar metadata do vídeo
      const duration = Math.floor(req.file.size / 10000); // Estimativa simples

      // Parar gravação e salvar
      const recording = await stopRecording(
        recordingId,
        req.file.buffer,
        duration
      );

      res.status(200).json({
        success: true,
        data: recording,
      });
    } catch (error) {
      console.error('Error stopping recording:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stop recording',
      });
    }
  },
];

// @desc    Obter informações de uma gravação
// @route   GET /api/recordings/:id
// @access  Public (para compartilhamento)
export const getRecording = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = await Recording.findById(id)
      .populate('gameId', 'players status winner startedAt finishedAt')
      .populate('userId', 'nickname avatar')
      .populate('gameId.players.userId', 'nickname avatar');

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Verificar se está expirado
    if (recording.isExpired()) {
      return res.status(410).json({
        success: false,
        message: 'Recording has expired',
      });
    }

    // Incrementar views
    await recording.incrementViews();

    res.status(200).json({
      success: true,
      data: recording,
    });
  } catch (error) {
    console.error('Error getting recording:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get recording',
    });
  }
};

// @desc    Stream de vídeo
// @route   GET /api/recordings/:id/stream
// @access  Public (para compartilhamento)
export const streamRecording = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = await Recording.findById(id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Verificar se está expirado
    if (recording.isExpired()) {
      return res.status(410).json({
        success: false,
        message: 'Recording has expired',
      });
    }

    // Configurar headers para streaming
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', recording.size);

    // Suportar range requests para seek
    const range = req.headers.range;
    let start = 0;
    let end = recording.size - 1;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : recording.size - 1;
      const chunksize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${recording.size}`);
      res.setHeader('Content-Length', chunksize);
    }

    // Stream do GridFS com range
    const downloadStream = downloadFromGridFS(recording.fileId);
    
    // Aplicar range se especificado
    if (range) {
      downloadStream.start(start);
      downloadStream.end(end);
    }
    
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Error streaming recording:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming video',
        });
      }
    });
  } catch (error) {
    console.error('Error streaming recording:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to stream recording',
      });
    }
  }
};

// @desc    Deletar gravação (admin ou dono)
// @route   DELETE /api/recordings/:id
// @access  Private (admin ou dono)
export const deleteRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const recording = await Recording.findById(id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found',
      });
    }

    // Verificar permissão (admin ou dono)
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);

    if (
      user.role !== 'admin' &&
      recording.userId.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this recording',
      });
    }

    // Deletar arquivo do GridFS
    await deleteFromGridFS(recording.fileId);

    // Deletar documento
    await recording.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Recording deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete recording',
    });
  }
};

