import Queue from '../models/Queue.js';
import winston from 'winston';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/queue.log' }),
  ],
});

// Constantes de configuração
const QUEUE_MAX_SIZE = 25;

class QueueService {
  /**
   * Adiciona um usuário à fila
   * @param {string} userId - ID do usuário
   * @returns {Promise<{position: number, totalInQueue: number}>}
   */
  async addToQueue(userId) {
    try {
      // Verificar tamanho atual da fila
      const currentQueueSize = await Queue.countDocuments();

      if (currentQueueSize >= QUEUE_MAX_SIZE) {
        logger.warn(`Fila cheia. Tentativa de adicionar userId: ${userId}`);
        throw new Error('Fila cheia. Tente novamente mais tarde.');
      }

      // Verificar se o usuário já está na fila
      const existingEntry = await Queue.findOne({ userId });
      if (existingEntry) {
        // Retornar posição atual se já estiver na fila
        const position = await this.getUserPosition(userId);
        logger.info(`Usuário ${userId} já está na fila na posição ${position}`);
        return { position, totalInQueue: currentQueueSize };
      }

      // Adicionar à fila
      await Queue.create({ userId });

      // Calcular posição
      const position = await this.getUserPosition(userId);
      const totalInQueue = currentQueueSize + 1;

      logger.info(
        `Usuário ${userId} adicionado à fila. Posição: ${position}, Total: ${totalInQueue}`
      );

      return { position, totalInQueue };
    } catch (error) {
      logger.error(`Erro ao adicionar usuário ${userId} à fila: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove um usuário da fila
   * @param {string} userId - ID do usuário
   * @returns {Promise<boolean>}
   */
  async removeFromQueue(userId) {
    try {
      const result = await Queue.deleteOne({ userId });

      if (result.deletedCount > 0) {
        logger.info(`Usuário ${userId} removido da fila`);
        return true;
      }

      logger.warn(`Tentativa de remover usuário ${userId} que não está na fila`);
      return false;
    } catch (error) {
      logger.error(`Erro ao remover usuário ${userId} da fila: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém o status atual da fila
   * @returns {Promise<{totalInQueue: number, users: Array}>}
   */
  async getQueueStatus() {
    try {
      const users = await Queue.find().sort({ joinedAt: 1 }).populate('userId', 'username');

      const totalInQueue = users.length;

      logger.debug(`Status da fila: ${totalInQueue} usuários`);

      return {
        totalInQueue,
        users: users.map((entry, index) => ({
          userId: entry.userId._id,
          username: entry.userId.username,
          position: index + 1,
          joinedAt: entry.joinedAt,
        })),
      };
    } catch (error) {
      logger.error(`Erro ao obter status da fila: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca match (2 jogadores mais antigos na fila)
   * @returns {Promise<Array|null>}
   */
  async findMatch() {
    try {
      const players = await Queue.find().sort({ joinedAt: 1 }).limit(2);

      if (players.length === 2) {
        logger.info(`Match encontrado entre ${players[0].userId} e ${players[1].userId}`);
        return players;
      }

      return null;
    } catch (error) {
      logger.error(`Erro ao buscar match: ${error.message}`);
      throw error;
    }
  }

  /**
   * Atualiza o ping de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<boolean>}
   */
  async updatePing(userId) {
    try {
      const result = await Queue.updateOne({ userId }, { lastPing: Date.now() });

      if (result.modifiedCount > 0) {
        logger.debug(`Ping atualizado para usuário ${userId}`);
        return true;
      }

      logger.warn(`Tentativa de atualizar ping para usuário ${userId} que não está na fila`);
      return false;
    } catch (error) {
      logger.error(`Erro ao atualizar ping do usuário ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove usuários inativos da fila (sem ping por mais de 60s)
   * @returns {Promise<Array>} Lista de userIds removidos
   */
  async cleanInactiveUsers() {
    try {
      const inactivityTimeout = 60000; // 60 segundos
      const cutoffTime = Date.now() - inactivityTimeout;

      // Buscar usuários inativos
      const inactiveUsers = await Queue.find({
        lastPing: { $lt: new Date(cutoffTime) },
      });

      if (inactiveUsers.length === 0) {
        return [];
      }

      // Remover usuários inativos
      const removedUserIds = [];
      for (const user of inactiveUsers) {
        const inactiveTime = Date.now() - new Date(user.lastPing).getTime();
        await Queue.deleteOne({ _id: user._id });
        removedUserIds.push(user.userId.toString());

        logger.info(
          `Usuário ${user.userId} removido por inatividade. Tempo sem ping: ${Math.floor(inactiveTime / 1000)}s`
        );
      }

      return removedUserIds;
    } catch (error) {
      logger.error(`Erro ao limpar usuários inativos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtém a posição de um usuário na fila
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>}
   * @private
   */
  async getUserPosition(userId) {
    try {
      const user = await Queue.findOne({ userId });
      if (!user) {
        return -1;
      }

      const position = await Queue.countDocuments({
        joinedAt: { $lt: user.joinedAt },
      });

      return position + 1;
    } catch (error) {
      logger.error(`Erro ao obter posição do usuário ${userId}: ${error.message}`);
      throw error;
    }
  }
}

export default new QueueService();
