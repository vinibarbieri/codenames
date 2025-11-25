import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  startRecording,
  stopRecording,
  getRecording,
  deleteRecording,
  getRecordingsByUser,
} from '../services/RecordingService.js';
import { downloadFromGridFS } from '../config/gridfs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for video file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../temp/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `recording-${uniqueSuffix}.webm`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/webm', 'video/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only WebM and MP4 are allowed.'));
    }
  },
});

export const uploadMiddleware = upload.single('video');

/**
 * @desc    Start a new recording
 * @route   POST /api/recordings/start
 * @access  Private
 */
export const handleStartRecording = async (req, res) => {
  try {
    const { gameId, settings } = req.body;
    const userId = req.user.userId;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID is required',
      });
    }

    const result = await startRecording(userId, gameId, settings);

    res.status(201).json({
      success: true,
      message: 'Recording started successfully',
      data: result,
    });
  } catch (error) {
    console.error('Start recording error:', error.message);

    if (
      error.message.includes('not found') ||
      error.message.includes('not active')
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message.includes('not a player') ||
      error.message.includes('Storage limit exceeded')
    ) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to start recording',
      error: error.message,
    });
  }
};

/**
 * @desc    Stop recording and upload video
 * @route   POST /api/recordings/stop
 * @access  Private
 */
export const handleStopRecording = async (req, res) => {
  let uploadedFilePath = null;

  try {
    const { recordingId } = req.body;
    const userId = req.user.userId;

    if (!recordingId) {
      return res.status(400).json({
        success: false,
        message: 'Recording ID is required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required',
      });
    }

    uploadedFilePath = req.file.path;

    const result = await stopRecording(recordingId, uploadedFilePath, userId);

    // Clean up uploaded file after processing
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    res.status(200).json({
      success: true,
      message: 'Recording stopped and saved successfully',
      data: result,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError.message);
      }
    }

    console.error('Stop recording error:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to stop recording',
      error: error.message,
    });
  }
};

/**
 * @desc    Get recording metadata
 * @route   GET /api/recordings/:id
 * @access  Public (for sharing)
 */
export const handleGetRecording = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = await getRecording(id);

    // Increment views
    await recording.incrementViews();

    res.status(200).json({
      success: true,
      data: recording.toPublicJSON(),
    });
  } catch (error) {
    console.error('Get recording error:', error.message);

    if (
      error.message.includes('not found') ||
      error.message.includes('expired')
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get recording',
      error: error.message,
    });
  }
};

/**
 * @desc    Stream recording video
 * @route   GET /api/recordings/:id/stream
 * @access  Public (for sharing)
 */
export const handleStreamRecording = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = await getRecording(id);

    if (!recording.fileId) {
      return res.status(404).json({
        success: false,
        message: 'Video file not found',
      });
    }

    // Set headers for video streaming
    res.set({
      'Content-Type': 'video/webm',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${recording.filename}"`,
    });

    // Create GridFS download stream
    const downloadStream = downloadFromGridFS(recording.fileId);

    // Handle stream errors
    downloadStream.on('error', error => {
      console.error('Stream error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming video',
        });
      }
    });

    // Pipe the stream to response
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Stream recording error:', error.message);

    if (
      error.message.includes('not found') ||
      error.message.includes('expired')
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to stream recording',
        error: error.message,
      });
    }
  }
};

/**
 * @desc    Delete recording
 * @route   DELETE /api/recordings/:id
 * @access  Private
 */
export const handleDeleteRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await deleteRecording(id, userId);

    res.status(200).json({
      success: true,
      message: 'Recording deleted successfully',
    });
  } catch (error) {
    console.error('Delete recording error:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete recording',
      error: error.message,
    });
  }
};

/**
 * @desc    Get user's recordings
 * @route   GET /api/recordings/user/me
 * @access  Private
 */
export const handleGetUserRecordings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;

    const recordings = await getRecordingsByUser(userId, limit);

    res.status(200).json({
      success: true,
      count: recordings.length,
      data: recordings,
    });
  } catch (error) {
    console.error('Get user recordings error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to get recordings',
      error: error.message,
    });
  }
};
