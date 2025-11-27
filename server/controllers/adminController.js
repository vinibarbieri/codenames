import configService from '../services/configService.js';
import User from '../models/User.js';
import Game from '../models/Game.js';
import Joi from 'joi';

// Schema de validação para atualização de config
const updateConfigSchema = Joi.object({
  value: Joi.any().required(),
  description: Joi.string().allow('').optional(),
});

/**
 * @desc    Listar todas as configurações
 * @route   GET /api/admin/config
 * @access  Admin
 */
export const getAllConfigs = async (req, res) => {
  try {
    const configs = await configService.getAllConfigs();
    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Erro ao buscar configs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Buscar configuração por key
 * @route   GET /api/admin/config/:key
 * @access  Admin
 */
export const getConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const config = await configService.getConfig(key);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada',
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Erro ao buscar config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configuração',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Atualizar configuração
 * @route   PUT /api/admin/config/:key
 * @access  Admin
 */
export const updateConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const { error, value } = updateConfigSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message),
      });
    }

    const config = await configService.updateConfig(
      key,
      value.value,
      value.description || ''
    );

    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: config,
    });
  } catch (error) {
    console.error('Erro ao atualizar config:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Buscar configurações públicas (não sensíveis)
 * @route   GET /api/config/public
 * @access  Public
 */
export const getPublicConfigs = async (req, res) => {
  try {
    // Lista de configs públicas que podem ser acessadas sem autenticação
    const publicKeys = ['videoChatEnabled', 'maxUsersPerGame'];
    const configs = await configService.getAllConfigs();

    const publicConfigs = configs
      .filter(config => publicKeys.includes(config.key))
      .map(config => ({
        key: config.key,
        value: config.value,
      }));

    res.json({
      success: true,
      data: publicConfigs,
    });
  } catch (error) {
    console.error('Erro ao buscar configs públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações públicas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Obter estatísticas do sistema
 * @route   GET /api/admin/stats
 * @access  Admin
 */
export const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isOnline: true });
    
    // Partidas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalGames = await Game.countDocuments();
    const gamesToday = await Game.countDocuments({
      createdAt: { $gte: today },
    });

    // Estatísticas de vídeos (se houver modelo Recording)
    let totalRecordings = 0;
    let storageUsed = 0;
    try {
      const Recording = (await import('../models/Recording.js')).default;
      totalRecordings = await Recording.countDocuments();
      const recordings = await Recording.find({}).select('size');
      storageUsed = recordings.reduce((sum, rec) => sum + (rec.size || 0), 0);
    } catch (error) {
      // Modelo Recording pode não existir ainda
      console.log('Modelo Recording não encontrado, pulando estatísticas de vídeo');
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalGames,
        gamesToday,
        totalRecordings,
        storageUsed, // em bytes
      },
    });
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Listar usuários com paginação
 * @route   GET /api/admin/users
 * @access  Admin
 */
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (search) {
      query.$or = [
        { nickname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Deletar usuário
 * @route   DELETE /api/admin/users/:id
 * @access  Admin
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.userId;

    // Não pode deletar a si mesmo
    if (id === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode deletar a si mesmo',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Atualizar role do usuário
 * @route   PUT /api/admin/users/:id/role
 * @access  Admin
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role inválido. Use: user, moderator ou admin',
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Role atualizado com sucesso',
      data: user,
    });
  } catch (error) {
    console.error('Erro ao atualizar role:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

