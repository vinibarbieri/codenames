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
 * Card distribution constants
 */
const TOTAL_CARDS = 25;
const RED_WORD_COUNT = 8;
const BLUE_WORD_COUNT = 8;
const ASSASSIN_COUNT = 1;
const NEUTRAL_WORD_COUNT = TOTAL_CARDS - (RED_WORD_COUNT + BLUE_WORD_COUNT + ASSASSIN_COUNT);

if (NEUTRAL_WORD_COUNT <= 0) {
  throw new Error('Invalid card distribution: neutral card count must be positive');
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
  if (!wordlist || wordlist.length < TOTAL_CARDS) {
    throw new Error('Wordlist must contain at least 25 words');
  }

  // Shuffle wordlist and pick 25 words
  const shuffledWords = shuffleArray(wordlist);
  const selectedWords = shuffledWords.slice(0, TOTAL_CARDS).map(entry => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
      if (entry.palavra) return entry.palavra;
      if (entry.word) return entry.word;
    }
    throw new Error(`Invalid word entry in wordlist: ${JSON.stringify(entry)}`);
  });

  // Create distribution: equal team counts with remaining neutrals and one assassin
  const types = [
    ...Array(RED_WORD_COUNT).fill('red'),
    ...Array(BLUE_WORD_COUNT).fill('blue'),
    ...Array(NEUTRAL_WORD_COUNT).fill('neutral'),
    ...Array(ASSASSIN_COUNT).fill('assassin'),
  ];

  if (types.length !== TOTAL_CARDS) {
    throw new Error('Invalid card distribution: total cards must equal 25');
  }

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
 * @param {string} [guessingTeam] - Team that made the guess (for assassin detection)
 * @returns {Promise<Object>} Updated game document
 */
export const checkGameResult = async (game, guessingTeam = null) => {
  // Check if assassin was revealed
  const assassinCard = game.board.find(card => card.type === 'assassin' && card.revealed);

  if (assassinCard) {
    // Team that revealed assassin loses
    // Use guessingTeam if provided, otherwise use currentTurn
    const losingTeam = guessingTeam || game.currentTurn;
    game.winner = losingTeam === 'red' ? 'blue' : 'red';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    return game;
  }

  // Count revealed cards by team
  const revealedRed = game.board.filter(card => card.type === 'red' && card.revealed).length;
  const revealedBlue = game.board.filter(card => card.type === 'blue' && card.revealed).length;

  // Log de depuração
  console.log(
    `[checkGameResult] Cartas reveladas - Vermelho: ${revealedRed}/${RED_WORD_COUNT}, Azul: ${revealedBlue}/${BLUE_WORD_COUNT}`,
  );

  // Check for victory - quando uma equipe acerta todas as suas palavras (0 restantes), o jogo termina
  if (revealedRed === RED_WORD_COUNT) {
    game.winner = 'red';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    console.log(
      `[checkGameResult] ✅ Jogo finalizado: Equipe Vermelha venceu (${RED_WORD_COUNT}/${RED_WORD_COUNT} cartas reveladas)`,
    );
    return game;
  }

  if (revealedBlue === BLUE_WORD_COUNT) {
    game.winner = 'blue';
    game.status = 'finished';
    game.finishedAt = new Date();
    await game.save();
    console.log(
      `[checkGameResult] ✅ Jogo finalizado: Equipe Azul venceu (${BLUE_WORD_COUNT}/${BLUE_WORD_COUNT} cartas reveladas)`,
    );
    return game;
  }

  console.log(`[checkGameResult] Jogo continua - Nenhuma equipe completou todas as palavras`);

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
  const baseWinPoints = 50;
  const baseLosePoints = -20;

  // Update scores for all players
  const updatePromises = game.players.map(async player => {
    const isWinner = player.team === game.winner;
    const points = isWinner ? baseWinPoints : baseLosePoints;

    // Buscar o usuário atual para verificar a pontuação antes de atualizar
    const user = await User.findById(player.userId);
    if (!user) {
      throw new Error(`User ${player.userId} not found`);
    }

    // Calcular nova pontuação e garantir que não fique negativa
    const newScore = Math.max(0, (user.score || 0) + points);

    await User.findByIdAndUpdate(player.userId, {
      $set: { score: newScore },
    });
  });

  await Promise.all(updatePromises);
};
