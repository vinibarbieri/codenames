import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Game from '../models/Game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load wordlist
let wordlist = [];
try {
  const wordlistPath = join(__dirname, '../data/wordlist.json');
  wordlist = JSON.parse(readFileSync(wordlistPath, 'utf-8'));
} catch (error) {
  console.error('Error loading wordlist:', error);
  throw new Error('Failed to load wordlist');
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
const shuffleArray = array => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Create game board with 25 random words and distributed types
 * @returns {Array} Array of 25 card objects {word, type, revealed}
 */
export const createGameBoard = () => {
  // Validate wordlist
  if (!wordlist || wordlist.length < 25) {
    throw new Error('Wordlist must contain at least 25 words');
  }

  // Shuffle wordlist and pick 25 words
  const shuffledWords = shuffleArray(wordlist);
  const selectedWords = shuffledWords.slice(0, 25);

  // Create distribution: 9 red, 8 blue, 7 neutral, 1 assassin
  const types = [
    ...Array(9).fill('red'),
    ...Array(8).fill('blue'),
    ...Array(7).fill('neutral'),
    'assassin',
  ];

  // Shuffle types
  const shuffledTypes = shuffleArray(types);

  // Map words to types
  const board = selectedWords.map((word, index) => ({
    word,
    type: shuffledTypes[index],
    revealed: false,
  }));

  return board;
};

/**
 * Initialize a new game
 * @param {Array} players - Array of player objects {userId, team, role}
 * @param {String} mode - Game mode (default: 'classic')
 * @returns {Promise<Object>} Created game document
 */
export const initializeGame = async (players, mode = 'classic') => {
  // Validate players
  if (!players || players.length < 2) {
    throw new Error('At least 2 players are required');
  }

  // Validate teams
  const redPlayers = players.filter(p => p.team === 'red');
  const bluePlayers = players.filter(p => p.team === 'blue');

  if (redPlayers.length === 0 || bluePlayers.length === 0) {
    throw new Error('Both teams must have at least one player');
  }

  // Validate spymasters
  const redSpymaster = redPlayers.find(p => p.role === 'spymaster');
  const blueSpymaster = bluePlayers.find(p => p.role === 'spymaster');

  if (!redSpymaster || !blueSpymaster) {
    throw new Error('Each team must have exactly one spymaster');
  }

  // Generate board
  const board = createGameBoard();

  // Randomly select starting team
  const currentTurn = Math.random() < 0.5 ? 'red' : 'blue';

  // Create game document
  const game = new Game({
    players,
    board,
    currentTurn,
    currentClue: {
      word: '',
      number: 0,
      remainingGuesses: 0,
    },
    status: 'active',
    winner: '',
    mode,
    turnCount: 0,
    recordingId: '',
    startedAt: new Date(),
    finishedAt: null,
  });

  // Save to database
  await game.save();

  return game;
};

/**
 * Check game result and update status if game is over
 * @param {Object} game - Game document
 * @returns {Promise<Object>} Updated game document
 */
export const checkGameResult = async game => {
  // Check if assassin was revealed
  const assassinCard = game.board.find(
    card => card.type === 'assassin' && card.revealed
  );

  if (assassinCard) {
    // Team that revealed assassin loses
    game.winner = game.currentTurn === 'red' ? 'blue' : 'red';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    return game;
  }

  // Count revealed cards by team
  const revealedRed = game.board.filter(
    card => card.type === 'red' && card.revealed
  ).length;
  const revealedBlue = game.board.filter(
    card => card.type === 'blue' && card.revealed
  ).length;

  // Check for victory
  if (revealedRed === 9) {
    game.winner = 'red';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    return game;
  }

  if (revealedBlue === 8) {
    game.winner = 'blue';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    return game;
  }

  return game;
};

/**
 * Update player scores after game ends
 * @param {Object} game - Finished game document
 * @returns {Promise<void>}
 */
export const updatePlayerScores = async game => {
  if (game.status !== 'finished' || !game.winner) {
    throw new Error('Game must be finished with a winner to update scores');
  }

  const User = (await import('../models/User.js')).default;

  // Calculate points
  const baseWinPoints = 10;
  const baseLosePoints = 3;
  const fastWinBonus = game.turnCount < 10 ? 5 : 0;

  // Update scores for all players
  const updatePromises = game.players.map(async player => {
    const isWinner = player.team === game.winner;
    const points = isWinner
      ? baseWinPoints + fastWinBonus
      : baseLosePoints;

    await User.findByIdAndUpdate(player.userId, {
      $inc: { score: points },
    });
  });

  await Promise.all(updatePromises);
};
