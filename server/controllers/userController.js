import User from '../models/User.js';
import Game from '../models/Game.js';

/**
 * Get user by ID
 * @route GET /api/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Get user statistics
 * @route GET /api/users/:id/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Buscar todas as partidas finalizadas do usuário
    const finishedGames = await Game.find({
      'players.userId': id,
      status: 'finished',
    }).sort({ finishedAt: -1 });

    // Calcular estatísticas
    const totalMatches = finishedGames.length;
    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // Calcular vitórias, derrotas e best streak
    finishedGames.forEach(game => {
      const player = game.players.find(p => p.userId.toString() === id.toString());
      if (!player) return;

      const isWinner = player.team === game.winner;
      
      if (isWinner) {
        wins++;
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        losses++;
        tempStreak = 0;
      }
    });

    // Calcular current streak (vitórias consecutivas começando da partida mais recente)
    for (const game of finishedGames) {
      const player = game.players.find(p => p.userId.toString() === id.toString());
      if (!player) continue;

      const isWinner = player.team === game.winner;
      
      if (isWinner) {
        currentStreak++;
      } else {
        // Streak quebrado, para de contar
        break;
      }
    }

    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Calcular média de pontos (baseado no sistema de pontuação: +50 vitória, -20 derrota)
    const baseWinPoints = 50;
    const baseLosePoints = -20;
    const totalPoints = wins * baseWinPoints + losses * baseLosePoints;
    const avgScore = totalMatches > 0 ? Math.round(totalPoints / totalMatches) : 0;

    const stats = {
      totalMatches,
      wins,
      losses,
      winRate,
      avgScore,
      currentStreak,
      bestStreak,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error in getUserStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Get user match history
 * @route GET /api/users/:id/matches
 */
export const getUserMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Buscar partidas finalizadas onde o usuário participou
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const total = await Game.countDocuments({
      'players.userId': id,
      status: 'finished',
    });

    const games = await Game.find({
      'players.userId': id,
      status: 'finished',
    })
      .populate('players.userId', 'nickname avatar')
      .sort({ finishedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Formatar partidas para o frontend
    const matches = games.map(game => {
      const player = game.players.find(p => p.userId._id.toString() === id.toString());
      const isWinner = player && player.team === game.winner;

      // Encontrar oponentes (outros jogadores da equipe adversária)
      const opponentTeam = player.team === 'red' ? 'blue' : 'red';
      const opponents = game.players
        .filter(p => p.team === opponentTeam)
        .map(p => ({
          nickname: p.userId?.nickname || 'Jogador',
          avatar: p.userId?.avatar || '',
        }));

      // Calcular pontos ganhos/perdidos
      const baseWinPoints = 50;
      const baseLosePoints = -20;
      const score = isWinner ? baseWinPoints : baseLosePoints;

      // Formatar data
      const date = game.finishedAt
        ? new Date(game.finishedAt).toLocaleDateString('pt-BR')
        : new Date(game.createdAt).toLocaleDateString('pt-BR');

      return {
        id: game._id.toString(),
        opponent: opponents.length > 0 ? opponents[0].nickname : 'Oponente',
        opponents: opponents,
        result: isWinner ? 'Vitória' : 'Derrota',
        score,
        date,
        finishedAt: game.finishedAt || game.createdAt,
        team: player?.team || '',
        winner: game.winner,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        matches,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error in getUserMatches:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico de partidas',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/users/:id
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, city, state, country, avatar, age } = req.body;

    // Check if user is updating their own profile
    if (req.user.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar este perfil',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    // Check if nickname is already taken by another user
    if (nickname && nickname !== user.nickname) {
      const existingUser = await User.findOne({ nickname });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Nickname já está em uso',
        });
      }
    }

    // Update fields
    if (nickname) user.nickname = nickname;
    if (avatar) user.avatar = avatar;
    if (age) user.age = age;

    // Update location
    if (city || state || country) {
      user.location = {
        city: city || user.location.city,
        state: state || user.location.state,
        country: country || user.location.country,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Get recent matches for logged user
 * @route GET /api/users/me/matches/recent
 */
export const getRecentMatches = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
    }

    // Buscar últimas 3 partidas finalizadas
    const games = await Game.find({
      'players.userId': userId,
      status: 'finished',
    })
      .populate('players.userId', 'nickname avatar')
      .sort({ finishedAt: -1 })
      .limit(3);

    // Formatar partidas para o frontend
    const matches = games.map(game => {
      const player = game.players.find(p => p.userId._id.toString() === userId.toString());
      const isWinner = player && player.team === game.winner;

      // Encontrar oponentes (outros jogadores da equipe adversária)
      const opponentTeam = player.team === 'red' ? 'blue' : 'red';
      const opponents = game.players
        .filter(p => p.team === opponentTeam)
        .map(p => ({
          nickname: p.userId?.nickname || 'Jogador',
          avatar: p.userId?.avatar || '',
        }));

      // Calcular pontos ganhos/perdidos
      const baseWinPoints = 50;
      const baseLosePoints = -20;
      const score = isWinner ? baseWinPoints : baseLosePoints;

      // Formatar data
      const date = game.finishedAt
        ? new Date(game.finishedAt).toLocaleDateString('pt-BR')
        : new Date(game.createdAt).toLocaleDateString('pt-BR');

      return {
        id: game._id.toString(),
        opponent: opponents.length > 0 ? opponents[0].nickname : 'Oponente',
        opponents: opponents,
        result: isWinner ? 'Vitória' : 'Derrota',
        score,
        date,
      };
    });

    res.status(200).json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error('Error in getRecentMatches:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar partidas recentes',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

/**
 * Get ranking
 * @route GET /api/ranking
 */
export const getRanking = async (req, res) => {
  try {
    const { limit = 100, country, state, search } = req.query;

    // Build query
    const query = {};

    if (country) {
      query['location.country'] = country;
    }

    if (state) {
      query['location.state'] = state;
    }

    if (search) {
      query.nickname = { $regex: search, $options: 'i' };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ score: -1 })
      .limit(parseInt(limit));

    // Import Game model
    const Game = (await import('../models/Game.js')).default;

    // Calculate stats for each user
    const ranking = await Promise.all(
      users.map(async user => {
        // Find all finished games where user participated
        const finishedGames = await Game.find({
          'players.userId': user._id,
          status: 'finished',
          winner: { $ne: '' }, // Only games with a winner
        });

        // Calculate statistics
        let wins = 0;
        let losses = 0;

        finishedGames.forEach(game => {
          const player = game.players.find(
            p => p.userId.toString() === user._id.toString()
          );
          if (player && player.team === game.winner) {
            wins++;
          } else if (player) {
            losses++;
          }
        });

        const totalMatches = wins + losses;
        const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';

        return {
          id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          score: user.score,
          location: user.location,
          role: user.role,
          stats: {
            totalMatches,
            wins,
            losses,
            winRate: parseFloat(winRate),
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: ranking,
    });
  } catch (error) {
    console.error('Error in getRanking:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ranking',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};
