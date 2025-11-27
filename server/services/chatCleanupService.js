import ChatMessage from '../models/ChatMessage.js';
import winston from 'winston';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/chat-cleanup.log' }),
  ],
});

/**
 * Remove mensagens de chat mais antigas que 30 dias
 * @returns {Promise<{deletedCount: number}>}
 */
export const cleanupOldMessages = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ChatMessage.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    logger.info(
      `Limpeza de mensagens antigas concluída. ${result.deletedCount} mensagens removidas (mais antigas que 30 dias)`
    );

    return { deletedCount: result.deletedCount };
  } catch (error) {
    logger.error(`Erro ao limpar mensagens antigas: ${error.message}`);
    throw error;
  }
};

/**
 * Inicia o cronjob de limpeza de mensagens antigas
 * Executa uma vez por dia (24 horas)
 */
export const startCleanupCronjob = () => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

  // Executar imediatamente na inicialização
  cleanupOldMessages().catch(error => {
    logger.error(`Erro na primeira execução da limpeza: ${error.message}`);
  });

  // Agendar execução diária
  setInterval(() => {
    cleanupOldMessages().catch(error => {
      logger.error(`Erro na execução agendada da limpeza: ${error.message}`);
    });
  }, TWENTY_FOUR_HOURS);

  logger.info('Cronjob de limpeza de mensagens antigas iniciado (execução diária)');
};

