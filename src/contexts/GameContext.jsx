import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import socket from '../services/socket';

const GameContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider = ({ children, gameId }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [shakingCardIndex, setShakingCardIndex] = useState(null);
  const hasJoinedRef = useRef(false);

  // ------------------------------------------------------------------
  // Conectar ao jogo quando gameId e user estiverem disponíveis
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!gameId || !user) return;

    // Resetar flag quando gameId mudar
    hasJoinedRef.current = false;

    // Verificar se já está conectado (caso venha da fila)
    if (socket.connected) {
      setIsConnected(true);
      console.log('Socket já conectado ao jogo');
    }

    const handleConnect = () => {
      setIsConnected(true);
      console.log('Socket conectado ao jogo');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('Socket desconectado do jogo');
    };

    const handleGameState = data => {
      console.log('Estado do jogo recebido:', data);
      setGameState(data);
      setError(null);
    };

    const handleGameClue = data => {
      console.log('Dica recebida:', data);

      setGameState(prev => {
        if (!prev) {
          console.warn("⚠️ Ignorando game:clue porque gameState ainda não existe.");
          return prev;
        }

        return {
          ...prev,
          currentClue: data.clue,
        };
      });
    };

    const handleGameReveal = data => {
      console.log('Carta revelada:', data);
      setGameState(prev => {
        const newBoard = [...prev.board];
        newBoard[data.cardIndex] = {
          ...newBoard[data.cardIndex],
          revealed: true,
          type: data.cardType,
        };
        return {
          ...prev,
          board: newBoard,
        };
      });

      // Animação de shake se for erro
      if (!data.isCorrect) {
        setShakingCardIndex(data.cardIndex);
        setTimeout(() => setShakingCardIndex(null), 600);
      }
    };

    const handleGameTurn = data => {
      console.log('Turno mudou:', data);
      setGameState(prev => ({
        ...prev,
        currentTurn: data.currentTurn,
        turnCount: data.turnCount,
        currentClue: data.currentClue || {
          word: '',
          number: 0,
          remainingGuesses: 0,
        },
      }));
    };

    const handleGameEnd = data => {
      console.log('Jogo finalizado:', data);
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner: data.winner,
      }));
    };

    const handleGameError = data => {
      console.error('Erro no jogo:', data);
      setError(data.message || 'Erro desconhecido');
    };

    // Configurar listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game:state', handleGameState);
    socket.on('game:clue', handleGameClue);
    socket.on('game:reveal', handleGameReveal);
    socket.on('game:turn', handleGameTurn);
    socket.on('game:end', handleGameEnd);
    socket.on('game:error', handleGameError);

    // Emitir evento de join (apenas uma vez por gameId)
    const joinGame = () => {
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;

        const realUserId =
          user?._id ||
          user?.id ||
          user?.userId ||
          null;

        console.log("Emitindo game:join", { gameId, realUserId });

        socket.emit('game:join', {
                    gameId,
                    userId: realUserId,
                  });
      }
    };

    // Evitar múltiplos game:join
    if (!hasJoinedRef.current) {
      const realUserId = user.id || user._id;
      socket.emit("game:join", { gameId, userId: realUserId });
      console.log("Emitindo game:join", { gameId, realUserId });
      hasJoinedRef.current = true;
    }

    // Cleanup
    return () => {
      hasJoinedRef.current = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game:state', handleGameState);
      socket.off('game:clue', handleGameClue);
      socket.off('game:reveal', handleGameReveal);
      socket.off('game:turn', handleGameTurn);
      socket.off('game:end', handleGameEnd);
      socket.off('game:error', handleGameError);
    };
  }, [gameId, user]);

  // ------------------------------------------------------------------
  // Funções para emitir eventos (solo via REST, multiplayer via socket)
  // ------------------------------------------------------------------

  const sendClue = useCallback(async (clue) => {
    if (!gameId) return;

    // SOLO MODE → usar REST
    if (gameState?.mode === 'solo') {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        await fetch(`${API_URL}/games/solo/${gameId}/clue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            word: clue.word,
            number: clue.number,
          }),
        });

      } catch (err) {
        console.error("Erro ao enviar dica SOLO:", err);
      }
      return;
    }

    // MULTIPLAYER NORMAL
    socket.emit('game:clue', { gameId, word: clue.word, number: clue.number });

  }, [gameId, gameState]);


  const sendGuess = useCallback(async (cardIndex) => {
    if (!gameId) return;

    // MODO SOLO
    if (gameState?.mode === 'solo') {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        await fetch(`${API_URL}/games/solo/${gameId}/guess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ cardIndex }),
        });

      } catch (err) {
        console.error("Erro ao enviar palpite SOLO:", err);
      }
      return;
    }

    // MULTIPLAYER
    socket.emit('game:guess', { gameId, cardIndex });

  }, [gameId, gameState]);


  const forfeitGame = useCallback(async () => {
    if (!gameId) return;

    // MODO SOLO
    if (gameState?.mode === 'solo') {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        await fetch(`${API_URL}/games/solo/${gameId}/end`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

      } catch (err) {
        console.error("Erro ao encerrar SOLO:", err);
      }
      return;
    }

    // MULTIPLAYER
    socket.emit('game:forfeit', { gameId });

  }, [gameId, gameState]);


  const sendTimeout = useCallback(async () => {
    if (!gameId) return;

    // SOLO MODE
    if (gameState?.mode === 'solo') {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        await fetch(`${API_URL}/games/solo/${gameId}/end`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

      } catch (err) {
        console.error("Erro ao enviar timeout SOLO:", err);
      }
      return;
    }

    // MULTIPLAYER
    socket.emit('game:timeout', { gameId });

  }, [gameId, gameState]);


  // ------------------------------------------------------------------
  // Calcular cartas restantes
  // ------------------------------------------------------------------
  const getRemainingCards = useCallback((team) => {
    if (!gameState?.board) return 0;
    return gameState.board.filter(
      card => card.type === team && !card.revealed
    ).length;
  }, [gameState]);

  // ------------------------------------------------------------------
  // Obter informações do jogador atual
  // ------------------------------------------------------------------
  const getMyTeam = useCallback(() => {
    if (!gameState?.players || !user) return null;
    const player = gameState.players.find(
      p =>
        p.userId === user.id ||
        p.userId === user._id ||
        p.userId?.toString() === (user.id || user._id)?.toString()
    );
    return player?.team || null;
  }, [gameState, user]);

  const getMyRole = useCallback(() => {
    if (!gameState?.players || !user) return null;
    const player = gameState.players.find(
      p =>
        p.userId === user.id ||
        p.userId === user._id ||
        p.userId?.toString() === (user.id || user._id)?.toString()
    );
    return player?.role || null;
  }, [gameState, user]);

  // ------------------------------------------------------------------
  // VALUE DO CONTEXTO
  // ------------------------------------------------------------------
  const value = {
    gameState,
    isConnected,
    error,
    shakingCardIndex,
    sendClue,
    sendGuess,
    forfeitGame,
    sendTimeout,
    getRemainingCards,
    getMyTeam,
    getMyRole,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};