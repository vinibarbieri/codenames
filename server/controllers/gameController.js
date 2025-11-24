import Joi from 'joi';
import Game from '../models/Game.js';
import { initializeGame, checkGameResult, updatePlayerScores } from '../services/gameService.js';

// Validation schemas
const createGameSchema = Joi.object({
  players: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().required(),
        team: Joi.string().valid('red', 'blue').required(),
        role: Joi.string().valid('spymaster', 'operative').required(),
      })
    )
    .min(2)
    .required()
    .messages({
      'array.min': 'At least 2 players are required',
      'any.required': 'Players array is required',
    }),
  mode: Joi.string().default('classic').optional(),
});

const giveClueSchema = Joi.object({
  word: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Clue word cannot be empty',
    'any.required': 'Clue word is required',
  }),
  number: Joi.number().integer().min(1).max(9).required().messages({
    'number.min': 'Number must be between 1 and 9',
    'number.max': 'Number must be between 1 and 9',
    'any.required': 'Number is required',
  }),
});

const makeGuessSchema = Joi.object({
  cardIndex: Joi.number().integer().min(0).max(24).required().messages({
    'number.min': 'Card index must be between 0 and 24',
    'number.max': 'Card index must be between 0 and 24',
    'any.required': 'Card index is required',
  }),
});

// @desc    Create a new game
// @route   POST /api/games/create
// @access  Private
export const createGame = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createGameSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message),
      });
    }

    const { players, mode } = value;

    // Initialize game
    const game = await initializeGame(players, mode);

    return res.status(201).json({
      success: true,
      message: 'Game created successfully',
      data: game,
    });
  } catch (error) {
    console.error('Create game error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get game by ID
// @route   GET /api/games/:id
// @access  Private (game participant only)
export const getGame = async (req, res) => {
  try {
    const { id } = req.params;

    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Get user's role for proper data filtering
    const userRole = game.getPlayerRole(req.user.userId);

    return res.status(200).json({
      success: true,
      data: game.toPublicJSON(req.user.userId, userRole),
    });
  } catch (error) {
    console.error('Get game error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Give a clue as spymaster
// @route   POST /api/games/:id/clue
// @access  Private (game participant, spymaster of current team only)
export const giveClue = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = giveClueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message),
      });
    }

    const { word, number } = value;

    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if game is active
    if (game.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active',
      });
    }

    // Check if user is spymaster of current turn team
    const playerTeam = game.getPlayerTeam(req.user.userId);
    const playerRole = game.getPlayerRole(req.user.userId);

    if (playerRole !== 'spymaster') {
      return res.status(403).json({
        success: false,
        message: 'Only spymasters can give clues',
      });
    }

    if (playerTeam !== game.currentTurn) {
      return res.status(403).json({
        success: false,
        message: "It is not your team's turn",
      });
    }

    // Update current clue
    game.currentClue = {
      word: word.toUpperCase(),
      number,
      remainingGuesses: number + 1, // Can make number + 1 guesses
    };

    await game.save();

    return res.status(200).json({
      success: true,
      message: 'Clue given successfully',
      data: game.toPublicJSON(req.user.userId, playerRole),
    });
  } catch (error) {
    console.error('Give clue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to give clue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Make a guess as operative
// @route   POST /api/games/:id/guess
// @access  Private (game participant, operative of current team only)
export const makeGuess = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = makeGuessSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message),
      });
    }

    const { cardIndex } = value;

    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if game is active
    if (game.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active',
      });
    }

    // Check if user is operative of current turn team
    const playerTeam = game.getPlayerTeam(req.user.userId);
    const playerRole = game.getPlayerRole(req.user.userId);

    if (playerRole !== 'operative') {
      return res.status(403).json({
        success: false,
        message: 'Only operatives can make guesses',
      });
    }

    if (playerTeam !== game.currentTurn) {
      return res.status(403).json({
        success: false,
        message: "It is not your team's turn",
      });
    }

    // Check if clue was given
    if (!game.currentClue.word || game.currentClue.remainingGuesses === 0) {
      return res.status(400).json({
        success: false,
        message: 'Spymaster must give a clue first or no guesses remaining',
      });
    }

    // Check if card was already revealed
    const card = game.board[cardIndex];
    if (card.revealed) {
      return res.status(400).json({
        success: false,
        message: 'This card has already been revealed',
      });
    }

    // Reveal the card
    game.board[cardIndex].revealed = true;
    game.currentClue.remainingGuesses -= 1;

    // Check if guess was correct
    const isCorrectGuess = card.type === playerTeam;

    // If incorrect guess or no guesses remaining, switch turn
    if (!isCorrectGuess || game.currentClue.remainingGuesses === 0) {
      game.currentTurn = game.currentTurn === 'red' ? 'blue' : 'red';
      game.currentClue = {
        word: '',
        number: 0,
        remainingGuesses: 0,
      };
      game.turnCount += 1;
    }

    await game.save();

    // Check for game result (win/loss)
    const updatedGame = await checkGameResult(game);

    // Update player scores if game ended
    if (updatedGame.status === 'finished') {
      await updatePlayerScores(updatedGame);
    }

    return res.status(200).json({
      success: true,
      message: 'Guess made successfully',
      data: {
        game: updatedGame.toPublicJSON(req.user.userId, playerRole),
        revealedCard: {
          word: card.word,
          type: card.type,
        },
        isCorrectGuess,
      },
    });
  } catch (error) {
    console.error('Make guess error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to make guess',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    End game (force finish)
// @route   PUT /api/games/:id/end
// @access  Private (game participant only)
export const endGame = async (req, res) => {
  try {
    const { id } = req.params;

    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if game is already finished
    if (game.status === 'finished') {
      return res.status(400).json({
        success: false,
        message: 'Game is already finished',
      });
    }

    // Mark game as finished without winner
    game.status = 'finished';
    game.finishedAt = new Date();

    await game.save();

    return res.status(200).json({
      success: true,
      message: 'Game ended successfully',
      data: game.toPublicJSON(req.user.userId, game.getPlayerRole(req.user.userId)),
    });
  } catch (error) {
    console.error('End game error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to end game',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
