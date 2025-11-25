import { useState, useRef } from 'react';
import Button from './Button';
import Modal from './Modal';
import useRecording from '../hooks/useRecording';
import { useToast } from '../contexts/ToastContext';

/**
 * RecordingControls - Controles para gravação de partidas
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} props.gameId - ID do jogo atual
 * @param {boolean} [props.isGameActive=false] - Se o jogo está ativo
 * @param {HTMLCanvasElement} props.canvasRef - Referência para o canvas do jogo
 * @param {string} [props.className=''] - Classes CSS adicionais
 *
 * @example
 * <RecordingControls
 *   gameId="12345"
 *   isGameActive={true}
 *   canvasRef={canvasRef}
 * />
 */
const RecordingControls = ({
  gameId,
  isGameActive = false,
  canvasRef,
  className = '',
}) => {
  const { showToast } = useToast();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const settingsRef = useRef({
    fps: 24,
    fullScreen: false,
  });

  const {
    isRecording,
    duration,
    error,
    startRecording: startRec,
    stopRecording: stopRec,
  } = useRecording(gameId, isGameActive);

  /**
   * Format duration in MM:SS
   */
  const formatDuration = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle start recording with confirmation
   */
  const handleStartRecording = () => {
    if (!isGameActive) {
      showToast(
        'Não é possível gravar: o jogo não está ativo',
        'error'
      );
      return;
    }

    setShowConfirmModal(true);
  };

  /**
   * Confirm and start recording
   */
  const confirmStartRecording = async () => {
    try {
      setShowConfirmModal(false);

      if (!canvasRef || !canvasRef.current) {
        throw new Error('Canvas não está disponível para gravação');
      }

      await startRec(canvasRef.current, settingsRef.current);

      showToast(
        'Gravação iniciada com sucesso!',
        'success'
      );
    } catch (err) {
      console.error('Erro ao iniciar gravação:', err);
      showToast(
        err.message || 'Falha ao iniciar gravação',
        'error'
      );
    }
  };

  /**
   * Handle stop recording
   */
  const handleStopRecording = async () => {
    try {
      await stopRec();

      showToast(
        'Gravação finalizada e salva com sucesso!',
        'success'
      );
    } catch (err) {
      console.error('Erro ao parar gravação:', err);
      showToast(
        err.message || 'Falha ao finalizar gravação',
        'error'
      );
    }
  };

  // Show error toast if recording error occurs
  if (error) {
    showToast(error, 'error');
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 ${className}`}
        data-testid="recording-controls"
      >
        {!isRecording ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleStartRecording}
            disabled={!isGameActive}
            className="relative"
            data-testid="start-recording-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <circle cx="10" cy="10" r="8" fill="currentColor" />
            </svg>
            Gravar Partida
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            {/* Recording indicator with pulsing animation */}
            <div className="flex items-center gap-2 px-4 py-2 bg-error-100 dark:bg-error-900 rounded-lg">
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-error-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-error-600"></span>
              </div>
              <span className="text-error-800 dark:text-error-200 font-medium">
                REC
              </span>
              <span
                className="text-error-700 dark:text-error-300 font-mono text-sm"
                data-testid="recording-timer"
              >
                {formatDuration(duration)}
              </span>
            </div>

            {/* Stop button */}
            <Button
              variant="danger"
              size="md"
              onClick={handleStopRecording}
              data-testid="stop-recording-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <rect x="4" y="4" width="12" height="12" fill="currentColor" />
              </svg>
              Parar Gravação
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Iniciar Gravação"
      >
        <div className="space-y-4">
          <p className="text-secondary-700 dark:text-secondary-300">
            Você está prestes a iniciar a gravação desta partida.
          </p>

          <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-warning-600 dark:text-warning-400 mt-0.5 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-warning-800 dark:text-warning-200">
                  Permissão necessária
                </h4>
                <p className="text-sm text-warning-700 dark:text-warning-300 mt-1">
                  Você precisará autorizar o acesso ao microfone para incluir
                  áudio na gravação. Você pode negar se preferir gravar apenas o
                  vídeo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button variant="success" onClick={confirmStartRecording}>
              Iniciar Gravação
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RecordingControls;
