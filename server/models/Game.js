import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    players: [
  {
    // Jogador humano
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // bots não terão userId
    },

    // Jogador bot (id simbólico, ex: "bot", "bot-dummy-1")
    botId: {
      type: String,
      required: false,
    },

    // Flag explícita
    isBot: {
      type: Boolean,
      default: false,
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

    // Nome público (humano ou bot)
    username: {
      type: String,
      default: 'Unknown',
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
      enum: ['classic', 'solo', 'ranked'],
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

    soloMode: {
        type: {
          type: String,
          enum: ['bot-spymaster', 'bot-operative'],
        },
        difficulty: {
          type: String,
          enum: ['easy', 'medium', 'hard'],
          default: 'medium',
        },
        playerTeam: {
          type: String,
          enum: ['red', 'blue'],
        },
        botTeam: {
          type: String,
          enum: ['red', 'blue'],
        },
      },

  },
  {
    timestamps: true,
  }
);

// Method to get public game data (hides card types for operatives)
gameSchema.methods.toPublicJSON = function (userId, userRole) {
  const publicData = {
    id: this._id,
    players: this.players.map(p => ({
      userId: p.userId,
      username: p.username || "Unknown",
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

  // Solo mode info
  if (this.mode === "solo") {
    publicData.soloMode = this.soloMode;
  }

  // Board visibility rules
  if (this.mode === "solo") {
    // SOLO MODE: sempre mostrar os tipos REAIS (necessário para o bot + contagem)
    publicData.board = this.board.map(card => ({
      word: card.word,
      type: card.type,
      revealed: card.revealed,
    }));
  }
  else if (userRole === "spymaster" || this.status === "finished") {
    // Spymaster vê tudo
    publicData.board = this.board.map(card => ({
      word: card.word,
      type: card.type,
      revealed: card.revealed,
    }));
  } 
  else {
    // Operatives não veem tipos ocultos
    publicData.board = this.board.map(card => ({
      word: card.word,
      revealed: card.revealed,
      type: card.revealed ? card.type : null,
    }));
  }

  
  publicData.redRemaining = this.board.filter(
    c => c.type === "red" && !c.revealed
  ).length;

  publicData.blueRemaining = this.board.filter(
    c => c.type === "blue" && !c.revealed
  ).length;

  return publicData;
};

// Method to check if user is in game
gameSchema.methods.hasPlayer = function (userId) {
  return this.players.some(
    p => p.userId && p.userId.toString() === userId.toString()
  );
};

// Method to get player's team
gameSchema.methods.getPlayerTeam = function (userId) {
  const player = this.players.find(
    p => p.userId && p.userId.toString() === userId.toString()
  );
  return player ? player.team : null;
};

// Method to get player's role
gameSchema.methods.getPlayerRole = function (userId) {
  const player = this.players.find(
    p => p.userId && p.userId.toString() === userId.toString()
  );
  return player ? player.role : null;
};

const Game = mongoose.model('Game', gameSchema);

export default Game;
