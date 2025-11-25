import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticação para Socket.io
 * Verifica o token JWT enviado na conexão e define socket.userId
 */
export const authenticateSocket = (socket, next) => {
  try {
    // Obter token do handshake (pode vir em auth.token ou query.token)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Permitir conexão sem token, mas socket.userId ficará undefined
      // Isso permite que usuários não autenticados se conectem, mas não possam usar funcionalidades que requerem auth
      return next();
    }

    // Verificar token
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return next(new Error('Server configuration error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Definir userId no socket
      socket.userId = decoded.userId;
      
      return next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        // Token inválido ou expirado, mas permitir conexão
        // O socket.userId ficará undefined e funcionalidades que requerem auth falharão
        console.warn(`Token inválido ou expirado para socket ${socket.id}: ${error.message}`);
        return next();
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Erro na autenticação do socket:', error);
    // Permitir conexão mesmo com erro, mas sem autenticação
    return next();
  }
};

