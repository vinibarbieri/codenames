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
});

socket.on('disconnect', reason => {
  console.log('Socket desconectado:', reason);
});

socket.on('connect_error', error => {
  console.error('Erro de conexão Socket.io:', error);
});

// socket.on("game:join", ({ gameId, userId }) => {
//   console.log(`[SOCKET] Usuário ${userId} entrou na sala ${gameId}`);
//   socket.join(gameId);
// });

export default socket;

