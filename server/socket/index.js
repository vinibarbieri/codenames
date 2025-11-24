import winston from 'winston';
import QueueService from '../services/QueueService.js';
import { initializeGame } from '../services/gameService.js';
import Game from '../models/Game.js';

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

    // ========== GAME EVENTS ==========

    // Event: game:join
    socket.on('game:join', async data => {
      try {
        const { gameId, userId } = data;

        if (!gameId || !userId) {
          socket.emit('game:error', { message: 'gameId e userId são obrigatórios' });
          return;
        }

        logger.info(`Usuário ${userId} tentando entrar no jogo ${gameId}`);

        // Buscar jogo no banco
        const game = await Game.findById(gameId);

        if (!game) {
          socket.emit('game:error', { message: 'Jogo não encontrado' });
          logger.warn(`Jogo ${gameId} não encontrado`);
          return;
        }

        // Verificar se usuário é participante
        const isParticipant = game.hasPlayer(userId);
        if (!isParticipant) {
          socket.emit('game:error', { message: 'Você não é participante deste jogo' });
          logger.warn(`Usuário ${userId} não é participante do jogo ${gameId}`);
          return;
        }

        // Armazenar userId no socket se ainda não estiver
        if (!socket.userId) {
          socket.userId = userId;
          userSockets.set(userId, socket.id);
        }

        // Obter role do jogador
        const userRole = game.getPlayerRole(userId);

        // Emitir estado inicial do jogo
        const gameState = game.toPublicJSON(userId, userRole);
        socket.emit('game:state', gameState);

        // Adicionar socket à sala do jogo (para broadcast posterior)
        socket.join(`game:${gameId}`);

        logger.info(`Usuário ${userId} entrou no jogo ${gameId} como ${userRole}`);
      } catch (error) {
        logger.error(`Erro no evento game:join: ${error.message}`);
        socket.emit('game:error', { message: error.message });
      }
    });

    // Event: game:clue
    socket.on('game:clue', async data => {
      try {
        const { gameId, word, number } = data;

        if (!gameId || !word || !number) {
          socket.emit('game:error', { message: 'gameId, word e number são obrigatórios' });
          return;
        }

        const userId = socket.userId;
        if (!userId) {
          socket.emit('game:error', { message: 'Usuário não autenticado' });
          return;
        }

        // Buscar jogo
        const game = await Game.findById(gameId);
        if (!game) {
          socket.emit('game:error', { message: 'Jogo não encontrado' });
          return;
        }

        // Verificar se é spymaster e turno correto
        const playerRole = game.getPlayerRole(userId);
        const playerTeam = game.getPlayerTeam(userId);

        if (playerRole !== 'spymaster') {
          socket.emit('game:error', { message: 'Apenas spymaster pode dar dicas' });
          return;
        }

        if (playerTeam !== game.currentTurn) {
          socket.emit('game:error', { message: 'Não é o turno da sua equipe' });
          return;
        }

        // Atualizar dica no jogo
        game.currentClue = {
          word,
          number,
          remainingGuesses: number + 1, // +1 porque pode errar uma vez
        };

        await game.save();

        // Broadcast dica para todos no jogo
        io.to(`game:${gameId}`).emit('game:clue', {
          clue: game.currentClue,
        });

        logger.info(`Spymaster ${userId} deu dica "${word}" (${number}) no jogo ${gameId}`);
      } catch (error) {
        logger.error(`Erro no evento game:clue: ${error.message}`);
        socket.emit('game:error', { message: error.message });
      }
    });

    // Event: game:guess
    socket.on('game:guess', async data => {
      try {
        const { gameId, cardIndex } = data;

        if (!gameId || cardIndex === undefined) {
          socket.emit('game:error', { message: 'gameId e cardIndex são obrigatórios' });
          return;
        }

        const userId = socket.userId;
        if (!userId) {
          socket.emit('game:error', { message: 'Usuário não autenticado' });
          return;
        }

        // Buscar jogo
        const game = await Game.findById(gameId);
        if (!game) {
          socket.emit('game:error', { message: 'Jogo não encontrado' });
          return;
        }

        // Verificar se é operative e turno correto
        const playerRole = game.getPlayerRole(userId);
        const playerTeam = game.getPlayerTeam(userId);

        if (playerRole !== 'operative') {
          socket.emit('game:error', { message: 'Apenas operatives podem fazer palpites' });
          return;
        }

        if (playerTeam !== game.currentTurn) {
          socket.emit('game:error', { message: 'Não é o turno da sua equipe' });
          return;
        }

        // Verificar se há dica ativa
        if (!game.currentClue.word || game.currentClue.remainingGuesses === 0) {
          socket.emit('game:error', { message: 'Spymaster deve dar uma dica primeiro' });
          return;
        }

        // Verificar se carta já foi revelada
        if (game.board[cardIndex].revealed) {
          socket.emit('game:error', { message: 'Carta já foi revelada' });
          return;
        }

        // Revelar carta
        game.board[cardIndex].revealed = true;
        game.currentClue.remainingGuesses -= 1;

        const card = game.board[cardIndex];
        const isCorrectGuess = card.type === playerTeam;

        // Se palpite incorreto ou sem palpites restantes, mudar turno
        if (!isCorrectGuess || game.currentClue.remainingGuesses === 0) {
          game.currentTurn = game.currentTurn === 'red' ? 'blue' : 'red';
          game.currentClue = {
            word: '',
            number: 0,
            remainingGuesses: 0,
          };
          game.turnCount += 1;
        }

        await game.save();

        // Broadcast revelação para todos no jogo
        io.to(`game:${gameId}`).emit('game:reveal', {
          cardIndex,
          cardType: card.type,
          isCorrect: isCorrectGuess,
        });

        // Se mudou turno, broadcast turno
        if (!isCorrectGuess || game.currentClue.remainingGuesses === 0) {
          io.to(`game:${gameId}`).emit('game:turn', {
            currentTurn: game.currentTurn,
            turnCount: game.turnCount,
            currentClue: game.currentClue,
          });
        }

        logger.info(`Operative ${userId} revelou carta ${cardIndex} (${card.type}) no jogo ${gameId}`);
      } catch (error) {
        logger.error(`Erro no evento game:guess: ${error.message}`);
        socket.emit('game:error', { message: error.message });
      }
    });

    // Event: game:forfeit
    socket.on('game:forfeit', async data => {
      try {
        const { gameId } = data;

        if (!gameId) {
          socket.emit('game:error', { message: 'gameId é obrigatório' });
          return;
        }

        const userId = socket.userId;
        if (!userId) {
          socket.emit('game:error', { message: 'Usuário não autenticado' });
          return;
        }

        // Buscar jogo
        const game = await Game.findById(gameId);
        if (!game) {
          socket.emit('game:error', { message: 'Jogo não encontrado' });
          return;
        }

        // Verificar se é participante
        if (!game.hasPlayer(userId)) {
          socket.emit('game:error', { message: 'Você não é participante deste jogo' });
          return;
        }

        // Determinar vencedor (equipe oposta)
        const playerTeam = game.getPlayerTeam(userId);
        const winner = playerTeam === 'red' ? 'blue' : 'red';

        // Finalizar jogo
        game.status = 'finished';
        game.winner = winner;
        game.finishedAt = new Date();

        await game.save();

        // Broadcast fim de jogo
        io.to(`game:${gameId}`).emit('game:end', {
          winner,
        });

        logger.info(`Jogo ${gameId} finalizado por desistência. Vencedor: ${winner}`);
      } catch (error) {
        logger.error(`Erro no evento game:forfeit: ${error.message}`);
        socket.emit('game:error', { message: error.message });
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
