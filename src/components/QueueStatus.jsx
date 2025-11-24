import { useQueue } from '../hooks/useQueue';
import Button from './Button';
import Loader from './Loader';

const QueueStatus = () => {
  const { queuePosition, totalInQueue, isInQueue, isConnected, joinQueue, leaveQueue } = useQueue();

  // Calcular tempo estimado (assumindo ~30s por posição)
  const estimatedTime = queuePosition * 30; // em segundos
  const estimatedMinutes = Math.ceil(estimatedTime / 60);

  if (!isInQueue) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isConnected
              ? 'Entre na fila para encontrar um oponente'
              : 'Conectando ao servidor...'}
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={joinQueue}
            disabled={!isConnected}
          >
            {isConnected ? 'Entrar na Fila' : 'Conectando...'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg text-center">
        <div className="flex items-center justify-center mb-2">
          <Loader size="sm" className="mr-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Buscando oponente...</p>
        </div>
        <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
          #{queuePosition}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {totalInQueue > 0 ? `${totalInQueue} jogador${totalInQueue > 1 ? 'es' : ''} na fila` : ''}
        </p>
        {estimatedMinutes > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Tempo estimado: ~{estimatedMinutes} min
          </p>
        )}
      </div>
      <Button variant="danger" className="w-full" onClick={leaveQueue}>
        Sair da Fila
      </Button>
    </div>
  );
};

export default QueueStatus;

