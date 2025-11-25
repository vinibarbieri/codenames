import { io } from 'socket.io-client';

// Obter URL do backend (sem /api para Socket.io)
const getBackendUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  // Remover /api do final se existir
  return apiUrl.replace(/\/api$/, '');
};

// Criar instância do socket
const socket = io(getBackendUrl(), {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Event listeners para debug
socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);
  
  // Tentar obter userId do localStorage se disponível
  // Isso é necessário para o chat funcionar mesmo sem entrar na fila/jogo
  const token = localStorage.getItem('token');
  if (token && !socket.userId) {
    try {
      // Decodificar JWT para obter userId (sem verificar assinatura, apenas para obter o ID)
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.userId) {
        socket.userId = payload.userId;
        console.log('Socket userId configurado:', socket.userId);
      }
    } catch (err) {
      console.warn('Não foi possível obter userId do token:', err);
    }
  }
});

socket.on('disconnect', reason => {
  console.log('Socket desconectado:', reason);
});

socket.on('connect_error', error => {
  console.error('Erro de conexão Socket.io:', error);
});

export default socket;

