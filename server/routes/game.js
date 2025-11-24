import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { verifyGameParticipant } from '../middleware/verifyGameParticipant.js';
import {
  createGame,
  getGame,
  giveClue,
  makeGuess,
  endGame,
} from '../controllers/gameController.js';

const router = express.Router();

// @route   POST /api/games/create
// @desc    Create a new game
// @access  Private
router.post('/create', authenticate, createGame);

// @route   GET /api/games/:id
// @desc    Get game by ID
// @access  Private (game participant only)
router.get('/:id', authenticate, verifyGameParticipant, getGame);

// @route   POST /api/games/:id/clue
// @desc    Give a clue as spymaster
// @access  Private (game participant, spymaster of current team only)
router.post('/:id/clue', authenticate, verifyGameParticipant, giveClue);

// @route   POST /api/games/:id/guess
// @desc    Make a guess as operative
// @access  Private (game participant, operative of current team only)
router.post('/:id/guess', authenticate, verifyGameParticipant, makeGuess);

// @route   PUT /api/games/:id/end
// @desc    End game (force finish)
// @access  Private (game participant only)
router.put('/:id/end', authenticate, verifyGameParticipant, endGame);

export default router;
