import { useEffect, useState, useRef } from 'react';

/**
 * ScoreBoard - Componente de placar do jogo
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {number} props.redRemaining - Cartas vermelhas restantes
 * @param {number} props.blueRemaining - Cartas azuis restantes
 * @param {number} props.turnCount - Número do turno atual
 * @param {number} [props.timerSeconds=60] - Segundos do timer de inatividade
 * @param {function} [props.onTimerExpire] - Callback quando timer expira
 *
 * @example
 * <ScoreBoard
 *   redRemaining={5}
 *   blueRemaining={7}
 *   turnCount={3}
 *   timerSeconds={60}
 *   onTimerExpire={() => handleTimeout()}
 * />
 */
const ScoreBoard = ({
  redRemaining,
  blueRemaining,
  turnCount,
  timerSeconds = 60,
  onTimerExpire,
}) => {
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const prevTurnCountRef = useRef(turnCount);

  // Resetar timer quando turnCount muda
  useEffect(() => {
    if (prevTurnCountRef.current !== turnCount && turnCount !== undefined) {
      prevTurnCountRef.current = turnCount;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(timerSeconds);
    }
  }, [turnCount, timerSeconds]);

  // Countdown do timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimerExpire?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onTimerExpire]);

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Equipe Vermelha */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">{redRemaining}</span>
          </div>
          <p className="text-xs text-secondary-600 dark:text-secondary-400">Vermelha</p>
        </div>

        {/* Turno */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">{turnCount}</span>
          </div>
          <p className="text-xs text-secondary-600 dark:text-secondary-400">Turno</p>
        </div>

        {/* Equipe Azul */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">{blueRemaining}</span>
          </div>
          <p className="text-xs text-secondary-600 dark:text-secondary-400">Azul</p>
        </div>
      </div>

      {/* Timer de inatividade */}
      <div className="mt-4 pt-4 border-t border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary-600 dark:text-secondary-400">Timer:</span>
          <span
            className={`text-lg font-mono font-bold ${
              timeLeft <= 10 ? 'text-error-600 dark:text-error-400' : 'text-secondary-900 dark:text-white'
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
        {timeLeft <= 10 && (
          <p className="text-xs text-error-600 dark:text-error-400 mt-1 text-center">
            Tempo acabando!
          </p>
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;

