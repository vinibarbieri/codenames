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

    console.log("Aqui1");
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
    console.log("Aqui2");
    // Criar jogo
    const game = await initializeGame(players, 'solo');

    console.log("TURN INICIAL:", game.currentTurn, "PLAYER TEAM:", team);

    if (mode === 'bot-operative') {
    game.currentTurn = team;       // humano começa dando dica
    } else {
    game.currentTurn = botTeam;    // bot começa dando dica
    }
    
    if (mode === 'bot-spymaster') {
        game.currentTurn = botTeam;
    } else {
        game.currentTurn = team;
    }

    game.soloMode = {
    type: mode,
    difficulty,
    playerTeam: team,
    botTeam,
    };
    
    await game.save();

    console.log("TURN INICIAL:", game.currentTurn, "PLAYER TEAM:", team);

    // Se o bot começar como spymaster, dar a primeira dica automaticamente
    if (mode === 'bot-spymaster' && game.currentTurn === team) {
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
    io.to(gameId).emit('game:reveal', {
      cardIndex,
      cardType: card.type,
      isCorrect: isCorrectGuess,
    });

    // Se acertou e ainda tem palpites, pode continuar
    // Se errou ou acabaram os palpites, passa o turno
    if (!gameEnded && (!isCorrectGuess || updatedGame.currentClue.remainingGuesses === 0)) {
      updatedGame.currentTurn = updatedGame.soloMode.botTeam;
      updatedGame.currentClue = { word: '', number: 0, remainingGuesses: 0 };
      updatedGame.turnCount += 1;
      await updatedGame.save();

      // Turno do bot
      io.to(gameId).emit('game:turn', {
        currentTurn: updatedGame.currentTurn,
        turnCount: updatedGame.turnCount,
      });

      // Bot jogará automaticamente
      if (updatedGame.soloMode.type === 'bot-spymaster') {
        setTimeout(() => handleBotSpymasterTurn(gameId), 2000);
      } else {
        setTimeout(() => handleBotOperativeTurn(gameId), 2000);
      }
    } else {
      await updatedGame.save();
    }

    if (gameEnded) {
      io.to(gameId).emit('game:end', {
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
    console.log('[giveSoloClue] dica recebida', gameId, word, number);

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
    io.to(gameId).emit('game:clue', {
      clue: game.currentClue,
    });

    console.log(`Bot deu dica: ${clue.word} ${clue.number}`);
  } catch (error) {
    console.error('Bot spymaster turn error:', error);
  }
};

/**
 * Bot Operative adivinha automaticamente
 */
const handleBotOperativeGuesses = async (gameId) => {
  try {
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'active') return;

    const difficulty = game.soloMode.difficulty;

    const guessTeam = game.soloMode.type === 'bot-operative'
      ? game.soloMode.playerTeam
      : game.soloMode.botTeam;

    console.log('[bot guess] tentando adivinhar...', game.currentClue, guessTeam);

    while (game.currentClue.remainingGuesses > 0 && game.status === 'active') {
      await botThinkingDelay(difficulty);

      const plainBoard = game.board.map(c => ({
        word: c.word,
        type: c.type,
        revealed: c.revealed,
      }));

      const guessIndex = await generateBotGuess(
        plainBoard,
        game.currentClue,
        guessTeam,
        difficulty
      );

      console.log('Retorno do bot guess: ', guessIndex);

      const card = game.board[guessIndex];
      console.log('Bot escolheu carta:', card);

      if (!card || card.revealed) continue;

      // Revelar carta
      game.board[guessIndex].revealed = true;
      game.currentClue.remainingGuesses -= 1;

      const isCorrectGuess = card.type === guessTeam;

      // 🔥 CORRIGIDO: Agora emitindo para a sala certa
      io.to(`game:${gameId}`).emit('game:reveal', {
        cardIndex: guessIndex,
        cardType: card.type,
        isCorrect: isCorrectGuess,
      });

      // Verificar resultado após a revelação
      const updatedGame = await checkGameResult(game, guessTeam);
      const gameEnded = updatedGame.status === 'finished';

      if (gameEnded) {
        io.to(`game:${gameId}`).emit('game:end', {
          winner: updatedGame.winner,
        });
        return;
      }

      // Passar turno se for erro
      if (!isCorrectGuess) {
        updatedGame.currentTurn = updatedGame.soloMode.playerTeam;
        updatedGame.currentClue = { word: '', number: 0, remainingGuesses: 0 };
        updatedGame.turnCount += 1;

        await updatedGame.save();

        // 🔥 CORRIGIDO AQUI TAMBÉM
        io.to(`game:${gameId}`).emit('game:turn', {
          currentTurn: updatedGame.currentTurn,
          turnCount: updatedGame.turnCount,
          currentClue: updatedGame.currentClue,
        });

        return;
      }

      // Se acertou, salvar e continuar o loop
      await updatedGame.save();
    }

    // Sem mais palpites → troca de turno
    if (game.currentClue.remainingGuesses === 0) {
      game.currentTurn = game.soloMode.playerTeam;
      game.currentClue = { word: '', number: 0, remainingGuesses: 0 };
      game.turnCount += 1;

      await game.save();

      // 🔥 MUDADO AQUI TAMBÉM
      io.to(`game:${gameId}`).emit('game:turn', {
        currentTurn: game.currentTurn,
        turnCount: game.turnCount,
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

    console.log("Entrou no handleBotOp")
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

    io.to(gameId).emit('game:clue', {
      clue: game.currentClue,
    });

    // Bot operative adivinha
    await handleBotOperativeGuesses(gameId);
  } catch (error) {
    console.error('Bot operative turn error:', error);
  }
};

export { handleBotSpymasterTurn, handleBotOperativeTurn };