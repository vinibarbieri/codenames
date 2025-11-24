import User from '../models/User.js';

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

    // TODO: Calculate real stats from Match model when implemented
    const stats = {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgScore: 0,
      currentStreak: 0,
      bestStreak: 0,
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

    // TODO: Implement with Match model when available
    const matches = [];
    const total = 0;

    res.status(200).json({
      success: true,
      data: {
        matches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
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

    const ranking = users.map(user => ({
      id: user._id,
      nickname: user.nickname,
      avatar: user.avatar,
      score: user.score,
      location: user.location,
      role: user.role,
      // TODO: Add stats when Match model is implemented
      stats: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      },
    }));

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
