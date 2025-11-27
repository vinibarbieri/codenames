import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import gameRoutes from './routes/game.js';
import initializeSocketIO from './socket/index.js';
import soloGameRoutes from './routes/soloGameRoutes.js';

dotenv.config({ path: '../.env' });

const app = express();
app.use((req, res, next) => {
  console.log("ROTA RECEBIDA:", req.method, req.url);
  next();
});
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Configurar CORS para aceitar múltiplas origens (desenvolvimento)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:3000'];

// Função para verificar origem permitida
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    // Em desenvolvimento, aceitar qualquer localhost
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    
    // Verificar se está na lista de origens permitidas
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// Configurar Socket.io com CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// MongoDB connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI not set. Skipping database connection.');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Codenames API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games/solo', soloGameRoutes);
app.use('/api/games', gameRoutes);

// Start server
const startServer = async () => {
  await connectDB();

  // Inicializar Socket.io
  initializeSocketIO(io);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.io ready for connections`);
  });
};

startServer();

export default app;
export { io };
