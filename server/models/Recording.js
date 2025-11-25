import mongoose from 'mongoose';

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
      required: [true, 'GridFS file ID is required'],
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [0, 'Duration must be positive'],
      max: [7200, 'Duration cannot exceed 2 hours'],
    },
    size: {
      type: Number,
      required: [true, 'Size is required'],
      min: [0, 'Size must be positive'],
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
        min: [1, 'FPS must be at least 1'],
        max: [60, 'FPS cannot exceed 60'],
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
      sparse: true,
      trim: true,
    },
    views: {
      type: Number,
      default: 0,
      min: [0, 'Views cannot be negative'],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Método para incrementar views
recordingSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
  return this.views;
};

// Método para verificar se está expirado
recordingSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

// Método para gerar URL de compartilhamento
recordingSchema.methods.generateShareUrl = function () {
  const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
  const shareId = this._id.toString();
  this.shareUrl = `${baseUrl}/watch/${shareId}`;
  return this.shareUrl;
};

// Índices adicionais
recordingSchema.index({ expiresAt: 1 });
recordingSchema.index({ userId: 1, createdAt: -1 });

// Validação pré-save: gerar shareUrl se não existir
recordingSchema.pre('save', function (next) {
  if (!this.shareUrl && !this.isNew) {
    this.generateShareUrl();
  }
  next();
});

const Recording = mongoose.model('Recording', recordingSchema);

export default Recording;

