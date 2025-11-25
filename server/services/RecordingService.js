import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';
import Recording from '../models/Recording.js';
import Game from '../models/Game.js';
import {
  getGridFSBucket,
  uploadToGridFS,
  deleteFromGridFS,
} from '../config/gridfs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);

// Temporary directory for recordings
const TEMP_DIR = path.join(__dirname, '../temp/recordings');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Check if FFMPEG is installed
 * @returns {Promise<boolean>}
 */
export const checkFFMPEGInstalled = () => {
  return new Promise(resolve => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        console.error('FFMPEG not found:', err.message);
        resolve(false);
      } else {
        console.log('✅ FFMPEG is installed and available');
        resolve(true);
      }
    });
  });
};

/**
 * Start a new recording session
 * Creates a Recording document in pending state
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} gameId - Game ID
 * @param {Object} settings - Recording settings
 * @returns {Promise<Object>} Recording document with recordingId
 */
export const startRecording = async (userId, gameId, settings = {}) => {
  try {
    // Validate game exists and is active
    const game = await Game.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }

    // Check if user is in the game
    if (!game.hasPlayer(userId)) {
      throw new Error('User is not a player in this game');
    }

    // Check storage limit (1GB default)
    const maxStorage = 1024 * 1024 * 1024; // 1GB
    const hasExceededLimit = await Recording.hasExceededStorageLimit(
      userId,
      maxStorage
    );

    if (hasExceededLimit) {
      throw new Error(
        'Storage limit exceeded. Please delete some recordings or wait for them to expire.'
      );
    }

    // Create recording document
    const recording = new Recording({
      userId,
      gameId,
      filename: `game-${gameId}-${Date.now()}.webm`,
      format: 'webm',
      settings: {
        videoBitrate: settings.videoBitrate || '4000k',
        fps: settings.fps || 24,
        audioBitrate: settings.audioBitrate || '128k',
        fullScreen: settings.fullScreen || false,
      },
    });

    // Generate share URL
    recording.generateShareUrl();

    await recording.save();

    console.log(`Recording started: ${recording._id} for game ${gameId}`);

    return {
      recordingId: recording._id,
      filename: recording.filename,
      settings: recording.settings,
      shareUrl: recording.shareUrl,
    };
  } catch (error) {
    console.error('Error starting recording:', error.message);
    throw error;
  }
};

/**
 * Stop recording and process video file
 * @param {ObjectId} recordingId - Recording ID
 * @param {string} videoFilePath - Path to uploaded video file
 * @param {ObjectId} userId - User ID (for validation)
 * @returns {Promise<Object>} Updated recording document
 */
export const stopRecording = async (recordingId, videoFilePath, userId) => {
  let tempFilePath = null;

  try {
    // Find recording
    const recording = await Recording.findById(recordingId);
    if (!recording) {
      throw new Error('Recording not found');
    }

    // Validate ownership
    if (recording.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized: You can only stop your own recordings');
    }

    // Get file stats
    const stats = await statAsync(videoFilePath);
    const fileSizeInBytes = stats.size;

    // Get video duration and process video
    const { duration, processedPath } = await processVideo(videoFilePath);

    tempFilePath = processedPath;

    // Upload to GridFS
    const readStream = fs.createReadStream(processedPath);
    const fileId = await uploadToGridFS(recording.filename, readStream, {
      contentType: 'video/webm',
      recordingId: recording._id,
    });

    // Update recording document
    recording.fileId = fileId;
    recording.size = fileSizeInBytes;
    recording.duration = duration;

    await recording.save();

    console.log(
      `Recording stopped and saved: ${recordingId}, size: ${fileSizeInBytes} bytes, duration: ${duration}s`
    );

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      await unlinkAsync(tempFilePath);
    }

    return recording.toPublicJSON();
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await unlinkAsync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError.message);
      }
    }

    console.error('Error stopping recording:', error.message);
    throw error;
  }
};

/**
 * Process video with FFMPEG (compress and optimize)
 * @param {string} inputPath - Input video file path
 * @returns {Promise<Object>} Object with duration and processed file path
 */
export const processVideo = inputPath => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      TEMP_DIR,
      `processed-${Date.now()}-${path.basename(inputPath)}`
    );

    console.log(`Processing video: ${inputPath} -> ${outputPath}`);

    ffmpeg(inputPath)
      .videoCodec('libvpx-vp9')
      .audioCodec('libopus')
      .videoBitrate('4000k')
      .audioBitrate('128k')
      .fps(24)
      .outputOptions([
        '-preset medium', // Compression preset
        '-crf 30', // Quality (0-63, lower is better)
        '-deadline good', // Quality/speed tradeoff
      ])
      .output(outputPath)
      .on('start', commandLine => {
        console.log('FFMPEG process started:', commandLine);
      })
      .on('progress', progress => {
        if (progress.percent) {
          console.log(`Processing: ${Math.round(progress.percent)}% done`);
        }
      })
      .on('end', () => {
        // Get video duration
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (err) {
            console.error('Error getting video duration:', err.message);
            reject(err);
            return;
          }

          const duration = metadata.format.duration || 0;
          console.log(
            `Video processing complete. Duration: ${duration} seconds`
          );

          resolve({
            duration: Math.round(duration),
            processedPath: outputPath,
          });
        });
      })
      .on('error', err => {
        console.error('FFMPEG processing error:', err.message);
        reject(err);
      })
      .run();
  });
};

/**
 * Delete a recording and its file from GridFS
 * @param {ObjectId} recordingId - Recording ID
 * @param {ObjectId} userId - User ID (for authorization)
 * @returns {Promise<void>}
 */
export const deleteRecording = async (recordingId, userId) => {
  try {
    const recording = await Recording.findById(recordingId);

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Validate ownership
    if (recording.userId.toString() !== userId.toString()) {
      throw new Error('Unauthorized: You can only delete your own recordings');
    }

    // Delete file from GridFS if it exists
    if (recording.fileId) {
      await deleteFromGridFS(recording.fileId);
    }

    // Delete recording document
    await recording.deleteOne();

    console.log(`Recording deleted: ${recordingId}`);
  } catch (error) {
    console.error('Error deleting recording:', error.message);
    throw error;
  }
};

/**
 * Get recording by ID
 * @param {ObjectId} recordingId - Recording ID
 * @returns {Promise<Object>} Recording document with populated fields
 */
export const getRecording = async recordingId => {
  try {
    const recording = await Recording.findById(recordingId)
      .populate('userId', 'nickname avatar')
      .populate('gameId');

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Check if expired
    if (recording.isExpired()) {
      throw new Error('Recording has expired');
    }

    return recording;
  } catch (error) {
    console.error('Error getting recording:', error.message);
    throw error;
  }
};

/**
 * Get recordings by user
 * @param {ObjectId} userId - User ID
 * @param {number} limit - Maximum number of recordings to return
 * @returns {Promise<Array>} Array of recording documents
 */
export const getRecordingsByUser = async (userId, limit = 20) => {
  try {
    const recordings = await Recording.find({
      userId,
      expiresAt: { $gt: new Date() }, // Only non-expired
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('gameId', 'mode status winner');

    return recordings.map(r => r.toPublicJSON());
  } catch (error) {
    console.error('Error getting user recordings:', error.message);
    throw error;
  }
};

/**
 * Get recordings by game
 * @param {ObjectId} gameId - Game ID
 * @returns {Promise<Array>} Array of recording documents
 */
export const getRecordingsByGame = async gameId => {
  try {
    const recordings = await Recording.find({
      gameId,
      expiresAt: { $gt: new Date() }, // Only non-expired
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'nickname avatar');

    return recordings.map(r => r.toPublicJSON());
  } catch (error) {
    console.error('Error getting game recordings:', error.message);
    throw error;
  }
};

export default {
  checkFFMPEGInstalled,
  startRecording,
  stopRecording,
  processVideo,
  deleteRecording,
  getRecording,
  getRecordingsByUser,
  getRecordingsByGame,
};
