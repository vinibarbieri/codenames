import Game from '../models/Game.js';

/**
 * Middleware to verify if user is a participant of the game
 * @desc    Verifies that req.user.userId is in game.players
 * @access  Protected routes
 */
export const verifyGameParticipant = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user is authenticated (should be done by authenticate middleware first)
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Find game by ID
    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
      });
    }

    // Check if user is a participant
    const isParticipant = game.hasPlayer(req.user.userId);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant of this game',
      });
    }

    // Attach game to request for use in controllers (optional optimization)
    req.game = game;

    next();
  } catch (error) {
    console.error('Verify game participant error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify game participant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
