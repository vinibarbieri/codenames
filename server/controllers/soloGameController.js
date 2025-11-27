import Joi from 'joi';
import Game from '../models/Game.js';
import { initializeGame, checkGameResult, updatePlayerScores } from '../services/gameService.js';
import { generateBotClue, generateBotGuess, botThinkingDelay } from '../services/botService.js';
import { io } from '../index.js';

// Validation schemas
const createSoloGameSchema = Joi.object({
  mode: Joi.string().valid('bot-spymaster', 'bot-operative').required().messages({
    'any.only': 'Mode must be either bot-spymaster or bot-operative',
    'any.required': 'Mode is required',
  }),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').default('medium'),
  team: Joi.string().valid('red', 'blue').default('red'),
});

/**
 * Cria jogo solo contra bot
 * @route POST /api/games/solo/create
 */
export const createSoloGame = async (req, res) => {
  try {

    const { error, value } = createSoloGameSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message),
      });
    }

    const { mode, difficulty, team } = value;
    const userId = req.user.userId;
    const botTeam = team === 'red' ? 'blue' : 'red';

    // Configurar jogadores baseado no modo
    let players;
    if (mode === 'bot-spymaster') {
  // Jogador é operative, bot é spymaster
    players = [
    // humano
    {
      userId,
      isBot: false,
      team,
      role: 'operative',
      username: req.user.username,
    },
    // bot principal
    {
      botId: 'bot',
      isBot: true,
      team,
      role: 'spymaster',
      username: 'Bot Spymaster',
    },
    // bots auxiliares
    {
      botId: 'bot-dummy-1',
      isBot: true,
      team: botTeam,
      role: 'operative',
      username: 'Bot Player 1',
    },
    {
      botId: 'bot-dummy-2',
      isBot: true,
      team: botTeam,
      role: 'spymaster',
      username: 'Bot Player 2',
    },
  ];
} else {
  // Jogador é spymaster, bot é operative
  players = [
    // humano
    {
      userId,
      isBot: false,
      team,
      role: 'spymaster',
      username: req.user.username,
    },
    // bot principal
    {
      botId: 'bot',
      isBot: true,
      team,
      role: 'operative',
      username: 'Bot Operative',
    },
    // bots auxiliares
    {
      botId: 'bot-dummy-1',
      isBot: true,
      team: botTeam,
      role: 'spymaster',
      username: 'Bot Player 1',
    },
    {
      botId: 'bot-dummy-2',
      isBot: true,
      team: botTeam,
      role: 'operative',
      username: 'Bot Player 2',
    },
  ];
}
    // Criar jogo
    const game = await initializeGame(players, 'solo');

    game.currentTurn = team;

    game.soloMode = {
      type: mode,
      difficulty,
      playerTeam: team,
      botTeam,
    };

    await game.save();

    // Se o bot for spymaster, ele dá a primeira dica automaticamente
    // para o time do jogador (mesmo time do turno atual)
    if (mode === 'bot-spymaster') {
      setTimeout(async () => {
        await handleBotSpymasterTurn(game._id.toString());
      }, 2000);
    }

    return res.status(201).json({
      success: true,
      message: 'Solo game created successfully',
      data: game.toPublicJSON(userId, mode === 'bot-spymaster' ? 'operative' : 'spymaster'),
    });
  } catch (error) {
    console.error('Create solo game error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create solo game',
    });
  }
};

/**
 * Jogador faz um palpite (modo bot-spymaster)
 */
export const makeSoloGuess = async (req, res) => {
  try {
    const { id: gameId } = req.params;
    const { cardIndex } = req.body;
    const userId = req.user.userId;

    const game = await Game.findById(gameId);
    if (!game || game.mode !== 'solo') {
      return res.status(404).json({
        success: false,
        message: 'Solo game not found',
      });
    }

    if (game.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Game is not active',
      });
    }

    const playerTeam = game.soloMode.playerTeam;
    
    if (game.currentTurn !== playerTeam) {
      return res.status(400).json({
        success: false,
        message: 'Not your team turn',
      });
    }

    // Validar carta
    const card = game.board[cardIndex];
    if (!card || card.revealed) {
      return res.status(400).json({
        success: false,
        message: 'Invalid card selection',
      });
    }

    // Revelar carta
    game.board[cardIndex].revealed = true;
    game.currentClue.remainingGuesses -= 1;
    
    const isCorrectGuess = card.type === playerTeam;

    // Verificar resultado do jogo
    const updatedGame = await checkGameResult(game, playerTeam);
    const gameEnded = updatedGame.status === 'finished';

    // Emitir evento de revelação
    io.to(`game:${gameId}`).emit('game:reveal', {
      cardIndex,
      cardType: card.type,
      isCorrect: isCorrectGuess,
    });

    // enviar estado atualizado após cada revelação
    const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
    for (const socketInGame of socketsInGame) {
      if (socketInGame.userId) {
        const userRole = updatedGame.getPlayerRole(socketInGame.userId);
        socketInGame.emit('game:state', updatedGame.toPublicJSON(socketInGame.userId, userRole));
      }
    }

    // Se acertou e ainda tem palpites, pode continuar
    // Se errou ou acabaram os palpites, passa o turno
    if (!gameEnded && (!isCorrectGuess || updatedGame.currentClue.remainingGuesses === 0)) {
    // 👉 Diferença de comportamento por modo solo
    if (updatedGame.soloMode.type === 'bot-spymaster') {
      // No modo bot-spymaster, SEMPRE continua sendo o turno do jogador
      updatedGame.currentTurn = updatedGame.soloMode.playerTeam;
    } else {
      // No modo bot-operative, passa o turno pro botTeam
      updatedGame.currentTurn = updatedGame.soloMode.botTeam;
    }

    updatedGame.currentClue = { word: '', number: 0, remainingGuesses: 0 };
    updatedGame.turnCount += 1;
    await updatedGame.save();

    // Notificar front da mudança de "round"
    io.to(`game:${gameId}`).emit('game:turn', {
      currentTurn: updatedGame.currentTurn,
      turnCount: updatedGame.turnCount,
      currentClue: updatedGame.currentClue,
    });

    // Bot joga automaticamente dependendo do modo
    if (updatedGame.soloMode.type === 'bot-spymaster') {
      // Bot do SEU time dá outra dica
      setTimeout(() => handleBotSpymasterTurn(gameId), 2000);
    } else {
      // No outro modo, o bot faz turno completo
      setTimeout(() => handleBotOperativeTurn(gameId), 2000);
    }
  } else {
    await updatedGame.save();
  }

    if (gameEnded) {
      io.to(`game:${gameId}`).emit('game:end', {
        winner: updatedGame.winner,
        winnerTeam: updatedGame.winner,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        game: updatedGame.toPublicJSON(userId, 'operative'),
        revealedCard: { word: card.word, type: card.type },
        isCorrectGuess,
      },
    });
  } catch (error) {
    console.error('Solo guess error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to make guess',
    });
  }
};

/**
 * Jogador dá dica (modo bot-operative)
 */
export const giveSoloClue = async (req, res) => {
  try {
    
    const { id: gameId } = req.params;
    const { word, number } = req.body;
    const userId = req.user.userId;

    const game = await Game.findById(gameId);
    if (!game || game.mode !== 'solo') {
      return res.status(404).json({
        success: false,
        message: 'Solo game not found',
      });
    }

    if (game.soloMode.type !== 'bot-operative') {
      return res.status(400).json({
        success: false,
        message: 'Invalid action for this game mode',
      });
    }

    const playerTeam = game.soloMode.playerTeam;
    
    if (game.currentTurn !== playerTeam) {
      return res.status(400).json({
        success: false,
        message: 'Not your team turn',
      });
    }

    // Atualizar dica
    game.currentClue = {
      word: word.toUpperCase(),
      number,
      remainingGuesses: number,
    };

    await game.save();

    // Emitir evento de dica
    io.to(`game:${gameId}`).emit('game:clue', {
      clue: game.currentClue,
    });

    // Bot começará a adivinhar após delay
    setTimeout(() => handleBotOperativeGuesses(gameId), 2000);

    return res.status(200).json({
      success: true,
      data: game.toPublicJSON(userId, 'spymaster'),
    });
  } catch (error) {
    console.error('Solo clue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to give clue',
    });
  }
};

/**
 * Bot Spymaster dá dica automaticamente
 */
const handleBotSpymasterTurn = async (gameId) => {
  try {
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'active') return;

    const difficulty = game.soloMode.difficulty;
    const playerTeam = game.soloMode.playerTeam;

    // Delay para simular pensamento
    await botThinkingDelay(difficulty);

    // Gerar dica do bot

    const plainBoard = game.board.map(c => ({
        word: c.word,
        type: c.type,
        revealed: c.revealed,
    }));


    const clue = await generateBotClue(plainBoard, playerTeam, difficulty);

    game.currentClue = {
      word: clue.word,
      number: clue.number,
      remainingGuesses: clue.number,
    };

    await game.save();

    // Emitir dica
    io.to(`game:${gameId}`).emit('game:clue', { clue: game.currentClue });
    const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
    for (const socketInGame of socketsInGame) {
      if (socketInGame.userId) {
        const userRole = game.getPlayerRole(socketInGame.userId);
        socketInGame.emit('game:state', game.toPublicJSON(socketInGame.userId, userRole));
      }
    }

  } catch (error) {
    console.error('Bot spymaster turn error:', error);
  }
};

/**
 * Bot Operative adivinha automaticamente
 */
const handleBotOperativeGuesses = async (gameId) => {
  try {
    let game = await Game.findById(gameId);
    if (!game || game.status !== 'active') return;

    const difficulty = game.soloMode.difficulty;

    // No modo bot-operative, o bot adivinha pelo MESMO time do jogador
    const guessTeam = game.soloMode.type === 'bot-operative'
      ? game.soloMode.playerTeam
      : game.soloMode.botTeam;


    // Enquanto ainda houver palpites e o jogo estiver ativo
    while (game.currentClue.remainingGuesses > 0 && game.status === 'active') {
      // Delay para simular pensamento
      await botThinkingDelay(difficulty);

      // Montar board simplificado
      const plainBoard = game.board.map((c) => ({
        word: c.word,
        type: c.type,
        revealed: c.revealed,
      }));

      // Índice da carta escolhida pelo bot
      const guessIndex = await generateBotGuess(
        plainBoard,
        game.currentClue,
        guessTeam,
        difficulty
      );


      const card = game.board[guessIndex];

      // Se carta inválida ou já revelada, tenta de novo
      if (!card || card.revealed) continue;

      // Revelar carta no estado em memória
      game.board[guessIndex].revealed = true;
      game.currentClue.remainingGuesses -= 1;

      const isCorrectGuess = card.type === guessTeam;

      // Salvar antes de checar resultado
      await game.save();

      // Emitir revelação para os clients
      io.to(`game:${gameId}`).emit('game:reveal', {
        cardIndex: guessIndex,
        cardType: card.type,
        isCorrect: isCorrectGuess,
      });

      // Verificar se o jogo terminou
      let updatedGame = await checkGameResult(game, guessTeam);
      const gameEnded = updatedGame.status === 'finished';

      if (gameEnded) {
        io.to(`game:${gameId}`).emit('game:end', {
          winner: updatedGame.winner,
        });
        return;
      }

      // Se o bot errou, passa turno para o jogador
      if (!isCorrectGuess) {
        updatedGame.currentTurn = updatedGame.soloMode.playerTeam;
        updatedGame.currentClue = { word: '', number: 0, remainingGuesses: 0 };
        updatedGame.turnCount += 1;

        await updatedGame.save();

        io.to(`game:${gameId}`).emit('game:turn', {
          currentTurn: updatedGame.currentTurn,
          turnCount: updatedGame.turnCount,
          currentClue: updatedGame.currentClue,
        });

        return;
      }

      // Se acertou e ainda tem guesses, continua o loop usando o estado atualizado
      game = updatedGame;
    }

    // Acabaram os palpites do bot → passa turno para o jogador
    if (game.currentClue.remainingGuesses === 0 && game.status === 'active') {
      game.currentTurn = game.soloMode.playerTeam;
      game.currentClue = { word: '', number: 0, remainingGuesses: 0 };
      game.turnCount += 1;

      await game.save();

      io.to(`game:${gameId}`).emit('game:turn', {
        currentTurn: game.currentTurn,
        turnCount: game.turnCount,
        currentClue: game.currentClue,
      });
    }
  } catch (error) {
    console.error('Bot operative guesses error:', error);
  }
};

/**
 * Bot joga turno completo automaticamente (para time adversário do bot)
 */
const handleBotOperativeTurn = async (gameId) => {
  try {

    const game = await Game.findById(gameId);
    if (!game || game.status !== 'active') return;

    const difficulty = game.soloMode.difficulty;
    const botTeam = game.soloMode.botTeam;

    // Bot spymaster do time adversário dá dica
    await botThinkingDelay(difficulty);
    const clue = await generateBotClue(game.board, botTeam, difficulty);

    game.currentClue = {
      word: clue.word,
      number: clue.number,
      remainingGuesses: clue.number,
    };

    await game.save();

    io.to(`game:${gameId}`).emit('game:clue', {
      clue: game.currentClue,
    });

    // Bot operative adivinha
    await handleBotOperativeGuesses(gameId);
  } catch (error) {
    console.error('Bot operative turn error:', error);
  }
};

export async function soloTimeout(req, res) {
  try {
    const { id: gameId } = req.params;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.mode !== "solo") {
      return res.status(400).json({ message: "Not a solo game" });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ message: "Game is not active" });
    }

    // Extrai info do modo solo
    const soloMode = game.soloMode || {};
    const mode = soloMode.type;
    const playerTeam = soloMode.playerTeam;
    const botTeam = soloMode.botTeam;


    // --------------------------------------------------------------------
    //  MODO 1: bot-spymaster
    //  Jogador e bot são do MESMO time.
    //  Timeout: não passa pro adversário, só faz o bot gerar nova dica.
    // --------------------------------------------------------------------
    if (mode === "bot-spymaster") {

      // Zera a dica atual
      game.currentClue = {
        word: "",
        number: 0,
        remainingGuesses: 0,
      };
      
      // Mantém o turno sempre no time do jogador
      game.currentTurn = playerTeam;
      game.turnCount += 1;

      await game.save();

      // Notifica front da mudança de "round"
      io.to(`game:${gameId}`).emit("game:turn", {
        currentTurn: game.currentTurn,
        turnCount: game.turnCount,
        currentClue: game.currentClue,
      });

      // Envia estado atualizado
      const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
      for (const socketInGame of socketsInGame) {
        if (socketInGame.userId) {
          const userRole = game.getPlayerRole(socketInGame.userId);
          socketInGame.emit('game:state', game.toPublicJSON(socketInGame.userId, userRole));
        }
      }

      // Bot spymaster gera uma nova dica pro jogador
      setTimeout(() => handleBotSpymasterTurn(gameId), 1500);

      return res.json({ success: true, message: "Timeout processado - Nova dica será gerada" });
    }

    // --------------------------------------------------------------------
    //  MODO 2: bot-operative
    //  Jogador dá dica, bot adivinha. Aqui sim há turnos alternados.
    // --------------------------------------------------------------------

    // Zera dica
    game.currentClue = {
      word: "",
      number: 0,
      remainingGuesses: 0,
    };

    // Alterna turno
    const oldTurn = game.currentTurn;
    game.currentTurn = game.currentTurn === playerTeam ? botTeam : playerTeam;
    game.turnCount += 1;

    await game.save();


    // Notifica mudança de turno
    io.to(`game:${gameId}`).emit("game:turn", {
      currentTurn: game.currentTurn,
      turnCount: game.turnCount,
      currentClue: game.currentClue,
    });

    // Envia estado atualizado
    const socketsInGame = await io.in(`game:${gameId}`).fetchSockets();
    for (const socketInGame of socketsInGame) {
      if (socketInGame.userId) {
        const userRole = game.getPlayerRole(socketInGame.userId);
        socketInGame.emit('game:state', game.toPublicJSON(socketInGame.userId, userRole));
      }
    }

    // Se virou o turno do bot, ele joga automaticamente
    if (game.currentTurn === botTeam) {
      setTimeout(() => handleBotOperativeTurn(gameId), 2000);
    }

    return res.json({ success: true, message: "Timeout processado - Turno alternado" });

  } catch (err) {
    console.error("❌ [TIMEOUT ERROR]:", err);
    return res.status(500).json({ message: "Internal error" });
  }
}