import Recording from '../models/Recording.js';
import { deleteFromGridFS } from '../utils/gridfs.js';
import winston from 'winston';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/recording-cleanup.log' }),
  ],
});

/**
 * Remove gravações expiradas (expiresAt < Date.now())
 * @returns {Promise<{deletedCount: number, freedSpace: number}>}
 */
export const cleanupExpiredRecordings = async () => {
  try {
    const now = new Date();

    // Buscar todas as gravações expiradas
    const expiredRecordings = await Recording.find({
      expiresAt: { $lt: now },
    });

    let deletedCount = 0;
    let freedSpace = 0;

    // Deletar arquivos do GridFS e documentos
    for (const recording of expiredRecordings) {
      try {
        // Deletar arquivo do GridFS
        await deleteFromGridFS(recording.fileId);
        freedSpace += recording.size || 0;

        // Deletar documento
        await recording.deleteOne();
        deletedCount++;
      } catch (error) {
        logger.error(
          `Erro ao deletar gravação ${recording._id}: ${error.message}`
        );
        // Continuar com as próximas gravações mesmo se uma falhar
      }
    }

    logger.info(
      `Limpeza de gravações expiradas concluída. ${deletedCount} gravações removidas, ${(freedSpace / 1024 / 1024).toFixed(2)}MB liberados`
    );

    return { deletedCount, freedSpace };
  } catch (error) {
    logger.error(`Erro ao limpar gravações expiradas: ${error.message}`);
    throw error;
  }
};

/**
 * Inicia o cronjob de limpeza de gravações expiradas
 * Executa diariamente às 3h da manhã
 */
export const startCleanupCronjob = () => {
  // Calcular milissegundos até as 3h da manhã
  const getMsUntil3AM = () => {
    const now = new Date();
    const threeAM = new Date();
    threeAM.setHours(3, 0, 0, 0);

    // Se já passou das 3h hoje, agendar para amanhã
    if (now > threeAM) {
      threeAM.setDate(threeAM.getDate() + 1);
    }

    return threeAM.getTime() - now.getTime();
  };

  // Executar imediatamente na inicialização
  cleanupExpiredRecordings().catch((error) => {
    logger.error(`Erro na primeira execução da limpeza: ${error.message}`);
  });

  // Agendar primeira execução às 3h
  const scheduleNext = () => {
    const msUntil3AM = getMsUntil3AM();
    setTimeout(() => {
      cleanupExpiredRecordings().catch((error) => {
        logger.error(`Erro na execução agendada da limpeza: ${error.message}`);
      });
      // Agendar próxima execução (24 horas depois)
      scheduleNext();
    }, msUntil3AM);
  };

  scheduleNext();

  logger.info('Cronjob de limpeza de gravações expiradas iniciado (execução diária às 3h)');
};

