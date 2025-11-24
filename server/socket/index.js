import winston from 'winston';
import QueueService from '../services/QueueService.js';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'logs/socket.log' }),
  ],
});

// Mapa para rastrear sockets por userId
const userSockets = new Map();

/**
 * Emite atualização da fila para todos os clientes conectados
 * @param {Object} io - Instância do Socket.io
 */
const broadcastQueueUpdate = async io => {
  try {
    const queueStatus = await QueueService.getQueueStatus();
    io.emit('queue:update', queueStatus);
    logger.debug(`Broadcast queue:update enviado. Total: ${queueStatus.totalInQueue}`);
  } catch (error) {
    logger.error(`Erro ao fazer broadcast da fila: ${error.message}`);
  }
};

/**
 * Inicializa o servidor Socket.io e configura os event listeners
 * @param {Object} io - Instância do Socket.io
 */
const initializeSocketIO = io => {
  // Namespace padrão '/'
  io.on('connection', socket => {
    logger.info(`Cliente conectado: ${socket.id}`);

    // Event: queue:join
    socket.on('queue:join', async data => {
      try {
        const { userId } = data;

        if (!userId) {
          socket.emit('queue:error', { message: 'userId é obrigatório' });
          return;
        }

        // Adicionar à fila
        const result = await QueueService.addToQueue(userId);

        // Armazenar mapeamento userId -> socket
        userSockets.set(userId, socket.id);
        socket.userId = userId;

        // Confirmar entrada na fila
        socket.emit('queue:joined', result);

        // Broadcast atualização da fila para todos
        await broadcastQueueUpdate(io);

        logger.info(`Usuário ${userId} entrou na fila via socket ${socket.id}`);
      } catch (error) {
        logger.error(`Erro no evento queue:join: ${error.message}`);
        socket.emit('queue:error', { message: error.message });
      }
    });

    // Event: queue:leave
    socket.on('queue:leave', async data => {
      try {
        const { userId } = data;

        if (!userId) {
          socket.emit('queue:error', { message: 'userId é obrigatório' });
          return;
        }

        // Remover da fila
        const removed = await QueueService.removeFromQueue(userId);

        if (removed) {
          // Remover mapeamento
          userSockets.delete(userId);
          delete socket.userId;

          // Confirmar saída da fila
          socket.emit('queue:left', { message: 'Removido da fila com sucesso' });

          // Broadcast atualização da fila para todos
          await broadcastQueueUpdate(io);

          logger.info(`Usuário ${userId} saiu da fila via socket ${socket.id}`);
        } else {
          socket.emit('queue:error', { message: 'Usuário não está na fila' });
        }
      } catch (error) {
        logger.error(`Erro no evento queue:leave: ${error.message}`);
        socket.emit('queue:error', { message: error.message });
      }
    });

    // Event: queue:ping
    socket.on('queue:ping', async data => {
      try {
        const { userId } = data;

        if (!userId) {
          return;
        }

        // Atualizar ping
        await QueueService.updatePing(userId);

        logger.debug(`Ping recebido do usuário ${userId}`);
      } catch (error) {
        logger.error(`Erro no evento queue:ping: ${error.message}`);
      }
    });

    // Event: disconnect
    socket.on('disconnect', () => {
      logger.info(`Cliente desconectado: ${socket.id}`);

      // Nota: A remoção automática da fila em caso de desconexão
      // será implementada na subtask 6.4 junto com a lógica de matchmaking
    });
  });

  // Configurar limpeza automática de usuários inativos a cada 30s
  setInterval(async () => {
    try {
      const removedUserIds = await QueueService.cleanInactiveUsers();

      if (removedUserIds.length > 0) {
        // Emitir 'queue:removed' para cada usuário removido
        for (const userId of removedUserIds) {
          const socketId = userSockets.get(userId);
          if (socketId) {
            const userSocket = io.sockets.sockets.get(socketId);
            if (userSocket) {
              userSocket.emit('queue:removed', {
                reason: 'inactivity',
                message: 'Você foi removido da fila por inatividade',
              });
            }
            userSockets.delete(userId);
          }
        }

        // Broadcast atualização da fila
        await broadcastQueueUpdate(io);
      }
    } catch (error) {
      logger.error(`Erro ao limpar usuários inativos: ${error.message}`);
    }
  }, 30000); // 30 segundos

  logger.info('Socket.io inicializado com sucesso');
  logger.info('Sistema de limpeza de inatividade iniciado (intervalo: 30s)');
};

export default initializeSocketIO;
export { userSockets, broadcastQueueUpdate };
