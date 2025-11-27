import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createSoloGame,
  makeSoloGuess,
  giveSoloClue,
  soloTimeout
} from "../controllers/soloGameController.js";
import { getGame, endGame } from '../controllers/gameController.js';

const router = express.Router();

// Criar jogo solo contra bot
router.post('/create', authenticate, createSoloGame);

// Obter estado do jogo solo
router.get('/:id', authenticate, getGame);

// Fazer palpite (modo bot-spymaster)
router.post('/:id/guess', authenticate, makeSoloGuess);

// Dar dica (modo bot-operative)
router.post('/:id/clue', authenticate, giveSoloClue);

// Encerrar jogo
router.put('/:id/end', authenticate, endGame);

router.post("/:id/timeout", authenticate, soloTimeout);

export default router;