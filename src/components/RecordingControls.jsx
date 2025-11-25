import { useState } from 'react';
import Button from './Button';
import Modal from './Modal';

/**
 * Componente de controles de gravação
 * @param {Object} props
 * @param {boolean} props.isRecording - Se está gravando
 * @param {number} props.duration - Duração em segundos
 * @param {string} props.error - Mensagem de erro
 * @param {Function} props.onStart - Callback para iniciar gravação
 * @param {Function} props.onStop - Callback para parar gravação
 * @param {boolean} props.disabled - Se os controles estão desabilitados
 */
const RecordingControls = ({
  isRecording,
  duration,
  error,
  onStart,
  onStop,
  disabled = false,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmStart = async () => {
    setShowConfirmModal(false);
    await onStart();
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 p-3 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-error-600 rounded-full animate-pulse"></div>
          <span className="text-sm font-semibold text-error-700 dark:text-error-300">
            Gravando
          </span>
          <span className="text-sm text-error-600 dark:text-error-400 font-mono">
            {formatDuration(duration)}
          </span>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={onStop}
          disabled={disabled}
        >
          Parar Gravação
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleStartClick}
          disabled={disabled}
        >
          🎥 Gravar Partida
        </Button>
        {error && (
          <div className="p-2 bg-error-50 dark:bg-error-900/20 rounded border border-error-200 dark:border-error-800">
            <p className="text-xs text-error-700 dark:text-error-300 font-medium">
              ⚠️ {error}
            </p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Iniciar Gravação"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-700 dark:text-secondary-300">
            A gravação irá capturar o áudio do seu microfone e o canvas do jogo.
            Você precisará permitir o acesso ao microfone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmStart}
            >
              Iniciar Gravação
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RecordingControls;

