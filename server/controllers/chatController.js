import ChatMessage from '../models/ChatMessage.js';
import Game from '../models/Game.js';

/**
 * @route   GET /api/chat/history
 * @desc    Get chat history
 * @access  Private
 */
export const getChatHistory = async (req, res) => {
  try {
    const { type, gameId, limit = 50 } = req.query;
    const userId = req.user.userId;

    if (!type) {
      return res.status(400).json({ message: 'type é obrigatório' });
    }

    if (type !== 'general' && type !== 'game') {
      return res.status(400).json({ message: 'type deve ser "general" ou "game"' });
    }

    // Se for mensagem de jogo, validar gameId e participação
    if (type === 'game') {
      if (!gameId) {
        return res.status(400).json({ message: 'gameId é obrigatório para histórico de jogo' });
      }

      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ message: 'Jogo não encontrado' });
      }

      if (!game.hasPlayer(userId)) {
        return res.status(403).json({ message: 'Você não é participante deste jogo' });
      }
    }

    // Buscar mensagens
    const query = { type };
    if (type === 'game' && gameId) {
      query.gameId = gameId;
    }

    const messages = await ChatMessage.find(query)
      .populate('userId', 'nickname avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    // Formatar mensagens
    const formattedMessages = messages.reverse().map(msg => ({
      _id: msg._id,
      userId: msg.userId._id,
      nickname: msg.userId.nickname,
      avatar: msg.userId.avatar || '',
      message: msg.message,
      type: msg.type,
      gameId: msg.gameId,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Erro ao buscar histórico de chat:', error);
    res.status(500).json({ message: error.message });
  }
};

