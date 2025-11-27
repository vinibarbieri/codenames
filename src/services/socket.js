import { io } from 'socket.io-client';

// Obter URL do backend (sem /api para Socket.io)
const getBackendUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  // Remover /api do final se existir
  return apiUrl.replace(/\/api$/, '');
};

// Obter token do localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

// Criar instância do socket com autenticação
const socket = io(getBackendUrl(), {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  auth: {
    token: getToken(),
  },
});

// Event listeners para debug
socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);
  
  // Garantir que o token está atualizado
  const token = getToken();
  if (token && socket.auth) {
    socket.auth.token = token;
  }
});

// Atualizar token quando o usuário fizer login/logout
socket.on('disconnect', () => {
  // Limpar token ao desconectar
  if (socket.auth) {
    socket.auth.token = null;
  }
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

