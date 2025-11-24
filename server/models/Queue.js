import mongoose from 'mongoose';

const queueSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastPing: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index para busca eficiente por userId
queueSchema.index({ userId: 1 });

// Index para busca eficiente por joinedAt (FIFO)
queueSchema.index({ joinedAt: 1 });

// Index para busca eficiente de usuários inativos
queueSchema.index({ lastPing: 1 });

const Queue = mongoose.model('Queue', queueSchema);

export default Queue;
