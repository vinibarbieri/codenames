import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import socket from '../services/socket';

const QUEUE_PING_INTERVAL = 30000; // 30 segundos

export const useQueue = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queuePosition, setQueuePosition] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);
  const [isInQueue, setIsInQueue] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const pingIntervalRef = useRef(null);
  const userIdRef = useRef(null);

  // Obter userId do usuário autenticado
  const getUserId = useCallback(() => {
    if (!user) return null;
    return user._id || user.id || null;
  }, [user]);

  // Enviar ping para manter conexão ativa
  const sendPing = useCallback(() => {
    const userId = userIdRef.current || getUserId();
    if (userId && isInQueue) {
      socket.emit('queue:ping', { userId });
    }
  }, [isInQueue, getUserId]);

  // Entrar na fila
  const joinQueue = useCallback(() => {
    const userId = getUserId();
    if (!userId) {
      console.error('Usuário não autenticado');
      return;
    }

    userIdRef.current = userId;
    socket.emit('queue:join', { userId });
  }, [getUserId]);

  // Sair da fila
  const leaveQueue = useCallback(() => {
    const userId = userIdRef.current || getUserId();
    if (!userId) {
      return;
    }

    socket.emit('queue:leave', { userId });
    userIdRef.current = null;
  }, [getUserId]);

  // Configurar listeners de Socket.io
  useEffect(() => {
    // Listener: conexão estabelecida
    const onConnect = () => {
      setIsConnected(true);
      console.log('Socket conectado');

      // Se estava na fila antes de desconectar, reconectar
      const wasInQueue = localStorage.getItem('inQueue') === 'true';
      if (wasInQueue && user) {
        const userId = getUserId();
        if (userId) {
          userIdRef.current = userId;
          socket.emit('queue:join', { userId });
        }
      }
    };

    // Listener: desconexão
    const onDisconnect = () => {
      setIsConnected(false);
      console.log('Socket desconectado');
    };

    // Listener: entrada na fila confirmada
    const onQueueJoined = data => {
      setIsInQueue(true);
      setQueuePosition(data.position || 0);
      setTotalInQueue(data.totalInQueue || 0);
      localStorage.setItem('inQueue', 'true');
      console.log('Entrou na fila:', data);
    };

    // Listener: saída da fila confirmada
    const onQueueLeft = () => {
      setIsInQueue(false);
      setQueuePosition(0);
      setTotalInQueue(0);
      localStorage.removeItem('inQueue');
      console.log('Saiu da fila');
    };

    // Listener: atualização da fila
    const onQueueUpdate = data => {
      if (isInQueue) {
        // Encontrar posição do usuário atual na fila
        const userId = userIdRef.current || getUserId();
        if (userId && data.users) {
          const userIndex = data.users.findIndex(
            u => u.userId === userId || u.userId.toString() === userId.toString()
          );
          if (userIndex !== -1) {
            setQueuePosition(data.users[userIndex].position);
          }
        }
        setTotalInQueue(data.totalInQueue || 0);
      }
    };

    // Listener: removido da fila
    const onQueueRemoved = data => {
      setIsInQueue(false);
      setQueuePosition(0);
      setTotalInQueue(0);
      localStorage.removeItem('inQueue');
      console.log('Removido da fila:', data);
    };

    // Listener: match encontrado
    const onGameMatched = data => {
      setIsInQueue(false);
      setQueuePosition(0);
      setTotalInQueue(0);
      localStorage.removeItem('inQueue');
      console.log('Match encontrado:', data);
      // Redirecionar para a partida
      if (data.gameId) {
        navigate(`/game/${data.gameId}`);
      }
    };

    // Listener: erro
    const onQueueError = error => {
      console.error('Erro na fila:', error);
    };

    // Registrar listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('queue:joined', onQueueJoined);
    socket.on('queue:left', onQueueLeft);
    socket.on('queue:update', onQueueUpdate);
    socket.on('queue:removed', onQueueRemoved);
    socket.on('game:matched', onGameMatched);
    socket.on('queue:error', onQueueError);

    // Verificar se já está conectado (usar callback para evitar setState direto)
    if (socket.connected) {
      onConnect();
    }

    // Limpar listeners ao desmontar
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('queue:joined', onQueueJoined);
      socket.off('queue:left', onQueueLeft);
      socket.off('queue:update', onQueueUpdate);
      socket.off('queue:removed', onQueueRemoved);
      socket.off('game:matched', onGameMatched);
      socket.off('queue:error', onQueueError);
    };
  }, [isInQueue, navigate, getUserId, user]);

  // Configurar ping automático quando estiver na fila
  useEffect(() => {
    if (isInQueue) {
      // Enviar ping imediatamente
      sendPing();

      // Configurar intervalo de ping
      pingIntervalRef.current = setInterval(() => {
        sendPing();
      }, QUEUE_PING_INTERVAL);
    } else {
      // Limpar intervalo quando sair da fila
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }

    // Limpar intervalo ao desmontar
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [isInQueue, sendPing]);

  // Limpar estado ao desmontar
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);

  return {
    queuePosition,
    totalInQueue,
    isInQueue,
    isConnected,
    joinQueue,
    leaveQueue,
    sendPing,
  };
};

