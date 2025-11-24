import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    players: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        team: {
          type: String,
          enum: ['red', 'blue'],
          required: true,
        },
        role: {
          type: String,
          enum: ['spymaster', 'operative'],
          required: true,
        },
      },
    ],
    board: [
      {
        word: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['red', 'blue', 'neutral', 'assassin'],
          required: true,
        },
        revealed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    currentTurn: {
      type: String,
      enum: ['red', 'blue'],
      required: true,
    },
    currentClue: {
      word: {
        type: String,
        default: '',
      },
      number: {
        type: Number,
        min: 0,
        max: 9,
        default: 0,
      },
      remainingGuesses: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'finished'],
      default: 'waiting',
    },
    winner: {
      type: String,
      enum: ['red', 'blue', ''],
      default: '',
    },
    mode: {
      type: String,
      default: 'classic',
    },
    turnCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    recordingId: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Method to get public game data (hides card types for operatives)
gameSchema.methods.toPublicJSON = function (userId, userRole) {
  const gameData = {
    id: this._id,
    players: this.players.map(p => ({
      userId: p.userId,
      team: p.team,
      role: p.role,
    })),
    currentTurn: this.currentTurn,
    currentClue: this.currentClue,
    status: this.status,
    winner: this.winner,
    mode: this.mode,
    turnCount: this.turnCount,
    startedAt: this.startedAt,
    finishedAt: this.finishedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };

  // Show full board only to spymasters or if game is finished
  if (userRole === 'spymaster' || this.status === 'finished') {
    gameData.board = this.board;
  } else {
    // Hide card types from operatives
    gameData.board = this.board.map(card => ({
      word: card.word,
      revealed: card.revealed,
      type: card.revealed ? card.type : 'hidden',
    }));
  }

  return gameData;
};

// Method to check if user is in game
gameSchema.methods.hasPlayer = function (userId) {
  return this.players.some(p => p.userId.toString() === userId.toString());
};

// Method to get player's team
gameSchema.methods.getPlayerTeam = function (userId) {
  const player = this.players.find(
    p => p.userId.toString() === userId.toString()
  );
  return player ? player.team : null;
};

// Method to get player's role
gameSchema.methods.getPlayerRole = function (userId) {
  const player = this.players.find(
    p => p.userId.toString() === userId.toString()
  );
  return player ? player.role : null;
};

const Game = mongoose.model('Game', gameSchema);

export default Game;
