import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameProvider, useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import GameBoard from '../components/GameBoard';
import ClueInput from '../components/ClueInput';
import TurnIndicator from '../components/TurnIndicator';
import ScoreBoard from '../components/ScoreBoard';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Loader from '../components/Loader';
import ChatBox from '../components/ChatBox';
import socket from '../services/socket';

/**
 * GamePage - Componente interno que usa o contexto do jogo
 */
const GamePageContent = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    gameState,
    isConnected,
    error,
    shakingCardIndex,
    sendClue,
    sendGuess,
    forfeitGame,
    sendTimeout,
    getMyTeam,
    getMyRole,
  } = useGame();

  const [showEndModal, setShowEndModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const hasShownEndModalRef = useRef(false);

  // Garantir que o socket tenha userId quando conectar
  useEffect(() => {
    if (socket.connected && user?.id && !socket.userId) {
      socket.userId = user.id || user._id;
    }
  }, [user, socket.connected]);

  // Mostrar modal de fim de jogo quando o jogo terminar
  useEffect(() => {
    if (gameState?.status === 'finished' && !hasShownEndModalRef.current) {
      hasShownEndModalRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowEndModal(true);
    } else if (gameState?.status !== 'finished') {
      hasShownEndModalRef.current = false;
    }
  }, [gameState?.status]);

  // Verificar se é o turno do jogador e se ele pode jogar
  const isMyTurn = gameState?.currentTurn === getMyTeam();
  const myRole = getMyRole();
  const isSpymaster = myRole === 'spymaster';
  const isOperative = myRole === 'operative';

  const canGiveClue = isSpymaster && isMyTurn && !gameState?.currentClue?.word;
  const canMakeGuess = isOperative && isMyTurn && gameState?.currentClue?.word && gameState?.currentClue?.remainingGuesses > 0;


  const redRemaining = gameState?.redRemaining ?? 0;
  const blueRemaining = gameState?.blueRemaining ?? 0;

  const handleClueSubmit = (clue) => {
    sendClue(clue);
  };

  const handleCardClick = (index) => {
    if (!canMakeGuess) return;
    if (gameState.board[index]?.revealed) return;
    sendGuess(index);
  };

  const handleForfeit = () => {
    forfeitGame();
    setShowForfeitModal(false);
    navigate('/lobby');
  };

  const handleTimerExpire = () => {
    // Timer expirado - passar o turno
    console.log('⏳ Timer de inatividade expirado - passando turno');
    sendTimeout();
  };

  
  // Loading state
  if (!isConnected || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-secondary-600 dark:text-secondary-400">
            {!isConnected ? 'Conectando ao jogo...' : 'Carregando estado do jogo...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && gameState?.status !== 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-error-600 dark:text-error-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/lobby')} variant="primary">
            Voltar ao Lobby
          </Button>
        </div>
      </div>
    );
  }

  const isWinner = gameState?.winner === getMyTeam();
  const winnerTeam = gameState?.winner === 'red' ? 'Vermelha' : gameState?.winner === 'blue' ? 'Azul' : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary-900 dark:text-white">
              Partida #{gameId?.slice(-6)}
            </h1>
            <Button variant="danger" size="sm" onClick={() => setShowForfeitModal(true)}>
              Desistir
            </Button>
          </div>

          {/* ScoreBoard e TurnIndicator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ScoreBoard
              redRemaining={redRemaining}
              blueRemaining={blueRemaining}
              turnCount={gameState.turnCount || 0}
              timerSeconds={60}
              onTimerExpire={handleTimerExpire}
              mode={gameState.mode}
            />
            <TurnIndicator
              currentTurn={gameState.currentTurn}
              myTeam={getMyTeam()}
              myRole={getMyRole()}
            />
          </div>
        </div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board - Central */}
          <div className="lg:col-span-2">
            <GameBoard
              cards={gameState.board || []}
              onCardClick={handleCardClick}
              disabled={!canMakeGuess}
              shakingCardIndex={shakingCardIndex}
              showTypes={isSpymaster}
            />
          </div>

          {/* Sidebar - Clue Input e Chat */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-semibold mb-4 text-secondary-900 dark:text-white">
                {isSpymaster ? 'Sua Dica' : 'Aguardando Dica'}
              </h2>
              <ClueInput
                onSubmit={handleClueSubmit}
                disabled={!canGiveClue}
                currentClue={gameState.currentClue?.word || ''}
                remainingGuesses={gameState.currentClue?.remainingGuesses || 0}
              />
            </div>

            {/* Chat do Jogo */}
            <div className="h-[400px]">
              <ChatBox
                type="game"
                gameId={gameId}
                user={user}
                socket={socket}
                isOpen={isChatOpen}
                onToggle={() => setIsChatOpen(!isChatOpen)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Fim de Jogo */}
      <Modal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        title={isWinner ? '🎉 Vitória!' : '😢 Derrota'}
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="text-center">
          <p className="text-lg mb-4 text-secondary-700 dark:text-secondary-300">
            {isWinner
              ? `Parabéns! A Equipe ${winnerTeam} venceu!`
              : `A Equipe ${winnerTeam} venceu!`}
          </p>
          <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-6">
            {isWinner ? 'Você ganhou +50 pontos!' : 'Você perdeu -20 pontos.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="primary"
              onClick={() => {
                setShowEndModal(false);
                navigate('/lobby');
              }}
            >
              Voltar ao Lobby
            </Button>
            {gameState.recordingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowEndModal(false);
                  navigate(`/watch/${gameState.recordingId}`);
                }}
              >
                Ver Replay
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação de Desistência */}
      <Modal
        isOpen={showForfeitModal}
        onClose={() => setShowForfeitModal(false)}
        title="Confirmar Desistência"
        size="sm"
      >
        <div className="text-center">
          <p className="mb-6 text-secondary-700 dark:text-secondary-300">
            Tem certeza que deseja desistir da partida? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={() => setShowForfeitModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleForfeit}>
              Desistir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/**
 * Game - Página principal do jogo com provider
 */
const Game = () => {
  const { id: gameId } = useParams();

  return (
    <GameProvider gameId={gameId}>
      <GamePageContent />
    </GameProvider>
  );
};

export default Game;