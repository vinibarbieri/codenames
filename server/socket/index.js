import winston from 'winston';
import DOMPurify from 'isomorphic-dompurify';
import QueueService from '../services/QueueService.js';
import { initializeGame, checkGameResult } from '../services/gameService.js';
import Game from '../models/Game.js';
import ChatMessage from '../models/ChatMessage.js';
import User from '../models/User.js';

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

// Mapa para rate limiting de mensagens: userId -> [{timestamp}]
const messageRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 10; // 10 mensagens por minuto

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
 * Cria um match entre 4 jogadores (2x2: 2 jogadores por equipe)
 * @param {Object} io - Instância do Socket.io
 * @param {Array} playersArray - Array de 4 jogadores [{userId}, {userId}, {userId}, {userId}]
 */
const createMatch = async (io, playersArray) => {
  try {
    if (playersArray.length !== 4) {
      throw new Error('createMatch requer exatamente 4 jogadores');
    }

    const userIds = playersArray.map(p => p.userId.toString());

    // Buscar sockets antes de remover da fila
    const sockets = new Map();

    // Buscar sockets por userId nos sockets conectados
    io.sockets.sockets.forEach(socket => {
      const userId = socket.userId?.toString();
      if (userIds.includes(userId)) {
        sockets.set(userId, socket);
      }
    });

    // Remover todos da fila
    for (const userId of userIds) {
      await QueueService.removeFromQueue(userId);
      userSockets.delete(userId);
    }

    // Sortear equipes aleatoriamente
    // Dividir 4 jogadores em 2 equipes (2 por equipe)
    // Cada equipe terá 1 spymaster e 1 operative
    const shuffledUserIds = [...userIds].sort(() => Math.random() - 0.5);
    
    // Atribuir equipes e roles
    // Red team: primeiro e segundo jogador (1 spymaster + 1 operative)
    // Blue team: terceiro e quarto jogador (1 spymaster + 1 operative)
    const players = [
      {
        userId: shuffledUserIds[0],
        team: 'red',
        role: 'spymaster',
      },
      {
        userId: shuffledUserIds[1],
        team: 'red',
        role: 'operative',
      },
      {
        userId: shuffledUserIds[2],
        team: 'blue',
        role: 'spymaster',
      },
      {
        userId: shuffledUserIds[3],
        team: 'blue',
        role: 'operative',
      },
    ];

    // Criar partida
    const game = await initializeGame(players, 'classic');
    const gameId = game._id.toString();

    const playersInfo = players.map(p => `${p.userId}(${p.team}/${p.role})`).join(', ');
    logger.info(`Match criado: gameId=${gameId}, players=[${playersInfo}]`);

    // Emitir 'game:matched' para todos os jogadores
    players.forEach(player => {
      const socket = sockets.get(player.userId);
      if (socket) {
        socket.emit('game:matched', {
          gameId,
          team: player.team,
          role: player.role,
        });
      }
    });

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
    logger.info(`Cliente conectado: ${socket.id}${socket.userId ? ` (userId: ${socket.userId})` : ' (não autenticado)'}`);
    
    // Se o socket tem userId (autenticado), armazenar mapeamento
    if (socket.userId) {
      userSockets.set(socket.userId, socket.id);
      logger.debug(`Socket ${socket.id} autenticado como userId ${socket.userId}`);
    }
    
    // Entrar automaticamente na room 'general' ao conectar
    socket.join('general');
    logger.debug(`Socket ${socket.id} entrou na room 'general'`);

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

        // Tentar encontrar match após adicionar à fila (requer 4 jogadores para jogo 2x2)
        const match = await QueueService.findMatch();
        if (match && match.length === 4) {
          // Criar match automaticamente com 4 jogadores
          await createMatch(io, match);
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
        
        // Entrar também na room de chat do jogo
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
          remainingGuesses: number, // Número exato de palpites permitidos
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

        // Salvar a revelação da carta antes de verificar o resultado
        await game.save();

        // Verificar se o jogo terminou (assassino ou vitória)
        // Passar playerTeam para detectar corretamente qual time revelou o assassino
        const updatedGame = await checkGameResult(game, playerTeam);
        const gameEnded = updatedGame.status === 'finished';
        
        // Log de depuração
        if (gameEnded) {
          logger.info(`[game:guess] Jogo ${gameId} terminou! Vencedor: ${updatedGame.winner}, Status: ${updatedGame.status}`);
        }

        // Se o jogo terminou por vitória (todas as palavras da equipe foram acertadas),
        // não mudar turno e não limpar a dica
        // Se palpite incorreto ou sem palpites restantes, mudar turno (a menos que o jogo tenha terminado)
        if (!gameEnded && (!isCorrectGuess || updatedGame.currentClue.remainingGuesses === 0)) {
          updatedGame.currentTurn = updatedGame.currentTurn === 'red' ? 'blue' : 'red';
          updatedGame.currentClue = {
            word: '',
            number: 0,
            remainingGuesses: 0,
          };
          updatedGame.turnCount += 1;
          await updatedGame.save();
        }

        // Broadcast revelação para todos no jogo
        io.to(`game:${gameId}`).emit('game:reveal', {
          cardIndex,
          cardType: card.type,
          isCorrect: isCorrectGuess,
        });

        // Se o jogo terminou, emitir evento de fim de jogo e estado atualizado
        if (gameEnded) {
          // Recarregar o jogo do banco para garantir que todas as mudanças foram aplicadas
          const finalGame = await Game.findById(gameId);
          
          // Enviar estado completo do jogo para todos os jogadores
          const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
          for (const socketInGame of socketsInGame) {
            if (socketInGame.userId) {
              const userRole = finalGame.getPlayerRole(socketInGame.userId);
              socketInGame.emit('game:state', finalGame.toPublicJSON(socketInGame.userId, userRole));
            }
          }
          
          io.to(`game:${gameId}`).emit('game:end', {
            winner: finalGame.winner,
            reason: card.type === 'assassin' ? 'assassin' : 'victory',
          });
          logger.info(`Jogo ${gameId} finalizado. Vencedor: ${finalGame.winner}, Razão: ${card.type === 'assassin' ? 'assassin' : 'victory'}`);
        } else if (!isCorrectGuess || updatedGame.currentClue.remainingGuesses === 0) {
          // Se mudou turno, broadcast turno
          io.to(`game:${gameId}`).emit('game:turn', {
            currentTurn: updatedGame.currentTurn,
            turnCount: updatedGame.turnCount,
            currentClue: updatedGame.currentClue,
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

    // Event: game:timeout
    socket.on('game:timeout', async data => {
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

        // Verificar se o jogo está ativo
        if (game.status !== 'active') {
          socket.emit('game:error', { message: 'Jogo não está ativo' });
          return;
        }

        // Verificar se o jogo terminou antes de mudar o turno
        const updatedGame = await checkGameResult(game);
        const gameEnded = updatedGame.status === 'finished';

        // Se o jogo não terminou, passar o turno para a equipe adversária
        if (!gameEnded) {
          updatedGame.currentTurn = updatedGame.currentTurn === 'red' ? 'blue' : 'red';
          updatedGame.currentClue = {
            word: '',
            number: 0,
            remainingGuesses: 0,
          };
          updatedGame.turnCount += 1;
          await updatedGame.save();

          // Broadcast mudança de turno
          io.to(`game:${gameId}`).emit('game:turn', {
            currentTurn: updatedGame.currentTurn,
            turnCount: updatedGame.turnCount,
            currentClue: updatedGame.currentClue,
          });

          logger.info(`Timer expirado no jogo ${gameId}. Turno passado para ${updatedGame.currentTurn}`);
        } else {
          // Se o jogo terminou, apenas enviar o estado atualizado
          const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
          for (const socketInGame of socketsInGame) {
            if (socketInGame.userId) {
              const userRole = updatedGame.getPlayerRole(socketInGame.userId);
              socketInGame.emit('game:state', updatedGame.toPublicJSON(socketInGame.userId, userRole));
            }
          }

          io.to(`game:${gameId}`).emit('game:end', {
            winner: updatedGame.winner,
            reason: 'timeout',
          });
        }
      } catch (error) {
        logger.error(`Erro no evento game:timeout: ${error.message}`);
        socket.emit('game:error', { message: error.message });
      }
    });

    // ========== CHAT EVENTS ==========

    // Event: chat:message
    socket.on('chat:message', async data => {
      try {
        const { type, message, gameId } = data;
        const userId = socket.userId;

        if (!userId) {
          socket.emit('chat:error', { message: 'Usuário não autenticado' });
          return;
        }

        if (!message || !type) {
          socket.emit('chat:error', { message: 'message e type são obrigatórios' });
          return;
        }

        // Validar tipo
        if (type !== 'general' && type !== 'game') {
          socket.emit('chat:error', { message: 'type deve ser "general" ou "game"' });
          return;
        }

        // Validar tamanho da mensagem
        if (message.length > 500) {
          socket.emit('chat:error', { message: 'Mensagem deve ter no máximo 500 caracteres' });
          return;
        }

        // Rate limiting: verificar se usuário excedeu limite
        const now = Date.now();
        const userMessages = messageRateLimit.get(userId) || [];
        
        // Remover mensagens antigas (fora da janela de tempo)
        const recentMessages = userMessages.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
        
        if (recentMessages.length >= RATE_LIMIT_MAX) {
          socket.emit('chat:error', { 
            message: `Limite de mensagens excedido. Máximo de ${RATE_LIMIT_MAX} mensagens por minuto.` 
          });
          return;
        }

        // Adicionar timestamp atual
        recentMessages.push(now);
        messageRateLimit.set(userId, recentMessages);

        // Sanitizar mensagem com DOMPurify
        const sanitizedMessage = DOMPurify.sanitize(message, {
          ALLOWED_TAGS: [], // Não permitir tags HTML
          ALLOWED_ATTR: [],
        });

        // Validar gameId se type for 'game'
        let finalGameId = null;
        if (type === 'game') {
          if (!gameId) {
            socket.emit('chat:error', { message: 'gameId é obrigatório para mensagens de jogo' });
            return;
          }

          // Verificar se jogo existe e usuário é participante
          const game = await Game.findById(gameId);
          if (!game) {
            socket.emit('chat:error', { message: 'Jogo não encontrado' });
            return;
          }

          if (!game.hasPlayer(userId)) {
            socket.emit('chat:error', { message: 'Você não é participante deste jogo' });
            return;
          }

          finalGameId = gameId;
        }

        // Buscar informações do usuário
        const user = await User.findById(userId).select('nickname avatar');
        if (!user) {
          socket.emit('chat:error', { message: 'Usuário não encontrado' });
          return;
        }

        // Salvar mensagem no banco
        const chatMessage = new ChatMessage({
          userId,
          gameId: finalGameId,
          type,
          message: sanitizedMessage,
        });

        await chatMessage.save();

        // Popular dados do usuário
        await chatMessage.populate('userId', 'nickname avatar');

        // Preparar mensagem para broadcast
        const messageData = {
          _id: chatMessage._id,
          userId: chatMessage.userId._id,
          nickname: user.nickname,
          avatar: user.avatar || '',
          message: sanitizedMessage,
          type,
          gameId: finalGameId,
          createdAt: chatMessage.createdAt,
        };

        // Emitir para a room correta
        if (type === 'game') {
          io.to(`game:${gameId}`).emit('chat:new_message', messageData);
          logger.debug(`Mensagem de jogo enviada por ${userId} no jogo ${gameId}`);
        } else {
          io.to('general').emit('chat:new_message', messageData);
          logger.debug(`Mensagem geral enviada por ${userId}`);
        }

        // Confirmar envio
        socket.emit('chat:message_sent', { messageId: chatMessage._id });
      } catch (error) {
        logger.error(`Erro no evento chat:message: ${error.message}`);
        socket.emit('chat:error', { message: error.message });
      }
    });

    // Event: chat:history
    socket.on('chat:history', async data => {
      try {
        const { type, gameId, limit = 50 } = data;
        const userId = socket.userId;

        if (!userId) {
          socket.emit('chat:error', { message: 'Usuário não autenticado' });
          return;
        }

        if (!type) {
          socket.emit('chat:error', { message: 'type é obrigatório' });
          return;
        }

        // Validar tipo
        if (type !== 'general' && type !== 'game') {
          socket.emit('chat:error', { message: 'type deve ser "general" ou "game"' });
          return;
        }

        // Se for mensagem de jogo, validar gameId e participação
        if (type === 'game') {
          if (!gameId) {
            socket.emit('chat:error', { message: 'gameId é obrigatório para histórico de jogo' });
            return;
          }

          const game = await Game.findById(gameId);
          if (!game) {
            socket.emit('chat:error', { message: 'Jogo não encontrado' });
            return;
          }

          if (!game.hasPlayer(userId)) {
            socket.emit('chat:error', { message: 'Você não é participante deste jogo' });
            return;
          }
        }

        // Buscar mensagens
        const query = { type };
        if (type === 'game' && gameId) {
          query.gameId = gameId;
        }

        const messages = await ChatMessage.find(query)
          .populate('userId', 'nickname avatar')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit, 10));

        // Formatar mensagens
        const formattedMessages = messages.reverse().map(msg => ({
          _id: msg._id,
          userId: msg.userId._id,
          nickname: msg.userId.nickname,
          avatar: msg.userId.avatar || '',
          message: msg.message,
          type: msg.type,
          gameId: msg.gameId,
          createdAt: msg.createdAt,
        }));

        socket.emit('chat:history', { messages: formattedMessages });
        logger.debug(`Histórico de chat enviado para ${userId} (type: ${type}, count: ${formattedMessages.length})`);
      } catch (error) {
        logger.error(`Erro no evento chat:history: ${error.message}`);
        socket.emit('chat:error', { message: error.message });
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
