import express from 'express';
import { authenticate, isAdmin } from '../middleware/auth.js';
import {
  getStats,
  getUsers,
  deleteUser,
  updateUserRole,
} from '../controllers/adminController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting mais estrito para rotas admin
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por 15 minutos
  message: 'Muitas requisições. Tente novamente em 15 minutos.',
});

// Aplicar rate limiting em todas as rotas admin
router.use(adminLimiter);

// Rotas protegidas (requerem autenticação e role admin)
router.get('/stats', authenticate, isAdmin, getStats);
router.get('/users', authenticate, isAdmin, getUsers);
router.delete('/users/:id', authenticate, isAdmin, deleteUser);
router.put('/users/:id/role', authenticate, isAdmin, updateUserRole);

export default router;

