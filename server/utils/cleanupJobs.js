import cron from 'node-cron';
import ChatMessage from '../models/ChatMessage.js';
import winston from 'winston';

// Configurar logger para cronjobs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/cleanup.log' }),
  ],
});

/**
 * Deleta mensagens de chat com mais de 30 dias
 */
const cleanupOldMessages = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await ChatMessage.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
    });

    logger.info(`Cronjob: Limpeza de mensagens antigas concluída. ${result.deletedCount} mensagens deletadas.`);
  } catch (error) {
    logger.error(`Erro ao executar cronjob de limpeza de mensagens: ${error.message}`);
  }
};

/**
 * Inicializa todos os cronjobs
 */
export const initializeCleanupJobs = () => {
  // Executar diariamente às 3h da manhã
  cron.schedule('0 3 * * *', cleanupOldMessages, {
    timezone: 'America/Sao_Paulo',
  });

  logger.info('Cronjob de limpeza de mensagens inicializado (execução diária às 3h)');
};

export default initializeCleanupJobs;
