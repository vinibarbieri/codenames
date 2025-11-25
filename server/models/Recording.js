import mongoose from 'mongoose';
import crypto from 'crypto';

const recordingSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: [true, 'Game ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Will be set after upload
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    duration: {
      type: Number, // Duration in seconds
      required: false,
      min: [0, 'Duration cannot be negative'],
      max: [7200, 'Maximum recording duration is 2 hours'], // 2 hours max
    },
    size: {
      type: Number, // Size in bytes
      required: false,
      min: [0, 'Size cannot be negative'],
    },
    format: {
      type: String,
      default: 'webm',
      enum: ['webm', 'mp4'],
    },
    settings: {
      videoBitrate: {
        type: String,
        default: '4000k',
      },
      fps: {
        type: Number,
        default: 24,
        min: 15,
        max: 60,
      },
      audioBitrate: {
        type: String,
        default: '128k',
      },
      fullScreen: {
        type: Boolean,
        default: false,
      },
    },
    shareUrl: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      default: function () {
        // Default expiration: 15 days from now
        const expirationDays = 15;
        return new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
recordingSchema.index({ gameId: 1, createdAt: -1 });
recordingSchema.index({ userId: 1, createdAt: -1 });
recordingSchema.index({ expiresAt: 1 });

/**
 * Generate a unique share URL for the recording
 * @returns {string} Unique share URL token
 */
recordingSchema.methods.generateShareUrl = function () {
  const token = crypto.randomBytes(16).toString('hex');
  this.shareUrl = token;
  return token;
};

/**
 * Increment view counter
 * @returns {Promise<Recording>}
 */
recordingSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
  return this;
};

/**
 * Check if recording is expired
 * @returns {boolean}
 */
recordingSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

/**
 * Get public recording data for API responses
 * @returns {Object}
 */
recordingSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    gameId: this.gameId,
    userId: this.userId,
    filename: this.filename,
    duration: this.duration,
    size: this.size,
    format: this.format,
    shareUrl: this.shareUrl,
    views: this.views,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

/**
 * Calculate total storage used by a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<number>} Total size in bytes
 */
recordingSchema.statics.getTotalStorageByUser = async function (userId) {
  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        expiresAt: { $gt: new Date() }, // Only count non-expired recordings
      },
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' },
      },
    },
  ]);

  return result.length > 0 ? result[0].totalSize : 0;
};

/**
 * Check if user has exceeded storage limit
 * @param {ObjectId} userId - User ID
 * @param {number} maxStorage - Maximum storage in bytes (default: 1GB)
 * @returns {Promise<boolean>}
 */
recordingSchema.statics.hasExceededStorageLimit = async function (
  userId,
  maxStorage = 1024 * 1024 * 1024
) {
  // 1GB default
  const totalStorage = await this.getTotalStorageByUser(userId);
  return totalStorage >= maxStorage;
};

/**
 * Delete expired recordings and their files from GridFS
 * @param {GridFSBucket} bucket - GridFS bucket instance
 * @returns {Promise<number>} Number of recordings deleted
 */
recordingSchema.statics.deleteExpiredRecordings = async function (bucket) {
  const expiredRecordings = await this.find({
    expiresAt: { $lt: new Date() },
  });

  let deletedCount = 0;

  for (const recording of expiredRecordings) {
    try {
      // Delete file from GridFS if it exists
      if (recording.fileId) {
        await bucket.delete(recording.fileId);
      }

      // Delete recording document
      await recording.deleteOne();
      deletedCount++;
    } catch (error) {
      console.error(
        `Failed to delete recording ${recording._id}:`,
        error.message
      );
    }
  }

  return deletedCount;
};

const Recording = mongoose.model('Recording', recordingSchema);

export default Recording;
