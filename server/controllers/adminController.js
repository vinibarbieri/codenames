import configService from '../services/configService.js';
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

