import winston from 'winston';

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

/**
 * Inicializa o servidor Socket.io e configura os event listeners
 * @param {Object} io - Instância do Socket.io
 */
const initializeSocketIO = io => {
  // Namespace padrão '/'
  io.on('connection', socket => {
    logger.info(`Cliente conectado: ${socket.id}`);

    // Event listeners serão implementados nas próximas subtasks
    // - queue:join
    // - queue:leave
    // - queue:ping
    // - disconnect

    socket.on('disconnect', () => {
      logger.info(`Cliente desconectado: ${socket.id}`);
    });
  });

  logger.info('Socket.io inicializado com sucesso');
};

export default initializeSocketIO;
