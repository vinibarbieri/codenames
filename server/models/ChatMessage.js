import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
    },
    type: {
      type: String,
      enum: ['general', 'game'],
      required: true,
      default: 'general',
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message must be less than 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Índices para melhor performance nas queries
chatMessageSchema.index({ gameId: 1, createdAt: -1 });
chatMessageSchema.index({ type: 1, createdAt: -1 });
chatMessageSchema.index({ createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;

