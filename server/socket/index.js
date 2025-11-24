import winston from 'winston';
import QueueService from '../services/QueueService.js';
import { initializeGame } from '../services/gameService.js';

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
 * Cria um match entre dois jogadores
 * @param {Object} io - Instância do Socket.io
 * @param {Object} player1 - Primeiro jogador {userId}
 * @param {Object} player2 - Segundo jogador {userId}
 */
const createMatch = async (io, player1, player2) => {
  try {
    const userId1 = player1.userId.toString();
    const userId2 = player2.userId.toString();

    // Buscar sockets antes de remover da fila
    let socket1 = null;
    let socket2 = null;

    // Buscar sockets por userId nos sockets conectados
    io.sockets.sockets.forEach(socket => {
      if (socket.userId === userId1) {
        socket1 = socket;
      }
      if (socket.userId === userId2) {
        socket2 = socket;
      }
    });

    // Remover ambos da fila
    await QueueService.removeFromQueue(userId1);
    await QueueService.removeFromQueue(userId2);

    // Remover mapeamentos de sockets
    userSockets.delete(userId1);
    userSockets.delete(userId2);

    // Sortear equipes aleatoriamente
    // Garantir que cada equipe tenha um spymaster
    const teams = ['red', 'blue'];
    const shuffledTeams = teams.sort(() => Math.random() - 0.5);

    // Atribuir equipes e roles
    // Para 2 jogadores: cada um será spymaster de sua equipe
    // Operatives podem ser adicionados depois ou jogados como bots
    const players = [
      {
        userId: userId1,
        team: shuffledTeams[0],
        role: 'spymaster',
      },
      {
        userId: userId2,
        team: shuffledTeams[1],
        role: 'spymaster',
      },
    ];

    // Criar partida
    const game = await initializeGame(players, 'classic');
    const gameId = game._id.toString();

    logger.info(
      `Match criado: gameId=${gameId}, players=[${userId1}(${players[0].team}/${players[0].role}), ${userId2}(${players[1].team}/${players[1].role})]`
    );

    // Emitir 'game:matched' para ambos jogadores
    if (socket1) {
      socket1.emit('game:matched', {
        gameId,
        team: players[0].team,
        role: players[0].role,
      });
    }

    if (socket2) {
      socket2.emit('game:matched', {
        gameId,
        team: players[1].team,
        role: players[1].role,
      });
    }

    // Broadcast atualização da fila
    await broadcastQueueUpdate(io);

    return game;
  } catch (error) {
    logger.error(`Erro ao criar match: ${error.message}`);
    throw error;
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

        // Tentar encontrar match após adicionar à fila
        const match = await QueueService.findMatch();
        if (match && match.length === 2) {
          // Criar match automaticamente
          await createMatch(io, match[0], match[1]);
        }
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
    socket.on('disconnect', async () => {
      logger.info(`Cliente desconectado: ${socket.id}`);

      // Remover usuário da fila se estiver conectado
      if (socket.userId) {
        try {
          await QueueService.removeFromQueue(socket.userId);
          userSockets.delete(socket.userId);
          logger.info(`Usuário ${socket.userId} removido da fila devido à desconexão`);
          // Broadcast atualização da fila
          await broadcastQueueUpdate(io);
        } catch (error) {
          logger.error(`Erro ao remover usuário ${socket.userId} da fila após desconexão: ${error.message}`);
        }
      }
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
