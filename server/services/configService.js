import Config from '../models/Config.js';
import winston from 'winston';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/config.log' }),
  ],
});

class ConfigService {
  /**
   * Busca uma configuração por key
   * @param {string} key - Chave da configuração
   * @returns {Promise<object|null>} - Configuração encontrada ou null
   */
  async getConfig(key) {
    try {
      const config = await Config.getByKey(key);
      return config;
    } catch (error) {
      logger.error(`Erro ao buscar config ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca o valor de uma configuração
   * @param {string} key - Chave da configuração
   * @param {*} defaultValue - Valor padrão se não encontrado
   * @returns {Promise<*>} - Valor da configuração ou defaultValue
   */
  async getConfigValue(key, defaultValue = null) {
    try {
      const config = await Config.getByKey(key);
      return config ? config.value : defaultValue;
    } catch (error) {
      logger.error(`Erro ao buscar valor de config ${key}: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Atualiza ou cria uma configuração
   * @param {string} key - Chave da configuração
   * @param {*} value - Valor da configuração
   * @param {string} description - Descrição opcional
   * @returns {Promise<object>} - Configuração atualizada/criada
   */
  async updateConfig(key, value, description = '') {
    try {
      const config = await Config.upsert(key, value, description);
      logger.info(`Config ${key} atualizada: ${JSON.stringify(value)}`);
      return config;
    } catch (error) {
      logger.error(`Erro ao atualizar config ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca todas as configurações
   * @returns {Promise<Array>} - Array de configurações
   */
  async getAllConfigs() {
    try {
      const configs = await Config.getAll();
      return configs;
    } catch (error) {
      logger.error(`Erro ao buscar todas as configs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicializa configurações padrão se não existirem
   * @returns {Promise<void>}
   */
  async initializeDefaults() {
    try {
      const defaults = [
        {
          key: 'queueMaxSize',
          value: 100,
          description: 'Tamanho máximo da fila de matchmaking',
        },
        {
          key: 'inactivityTimeout',
          value: 300000, // 5 minutos em ms
          description: 'Timeout de inatividade em milissegundos',
        },
        {
          key: 'maxVideoStorageDays',
          value: 30,
          description: 'Dias para manter vídeos antes de deletar',
        },
        {
          key: 'videoChatEnabled',
          value: true,
          description: 'Habilitar videochat nas partidas',
        },
        {
          key: 'maxUsersPerGame',
          value: 4,
          description: 'Número máximo de usuários por partida',
        },
      ];

      for (const defaultConfig of defaults) {
        const existing = await Config.getByKey(defaultConfig.key);
        if (!existing) {
          await Config.upsert(
            defaultConfig.key,
            defaultConfig.value,
            defaultConfig.description
          );
          logger.info(`Config padrão criada: ${defaultConfig.key}`);
        }
      }

      logger.info('Configurações padrão inicializadas');
    } catch (error) {
      logger.error(`Erro ao inicializar configs padrão: ${error.message}`);
      throw error;
    }
  }
}

export default new ConfigService();

