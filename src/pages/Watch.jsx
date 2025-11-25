import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Button from '../components/Button';
import Loader from '../components/Loader';
import { useToast } from '../contexts/ToastContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Watch - Página de visualização de gravações de partidas
 * @component
 */
const Watch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * Fetch recording data from API
   */
  const fetchRecording = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/recordings/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Gravação não encontrada ou expirada');
        }
        throw new Error('Erro ao carregar gravação');
      }

      const data = await response.json();
      setRecording(data.data);
    } catch (err) {
      console.error('Error fetching recording:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format duration from seconds to MM:SS
   */
  const formatDuration = seconds => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle share button click
   */
  const handleShare = async () => {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        // Use native share API if available
        await navigator.share({
          title: `Gravação de Partida - Codenames`,
          text: 'Confira esta partida de Codenames!',
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copiado para a área de transferência!', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        showToast('Erro ao compartilhar', 'error');
      }
    }
  };

  /**
   * Handle download button click
   */
  const handleDownload = () => {
    const downloadUrl = `${API_URL}/recordings/${id}/stream`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = recording?.filename || `recording-${id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-secondary-50 dark:bg-secondary-900 p-6">
        <div className="max-w-md w-full bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-8 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-error-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
            Erro ao carregar gravação
          </h2>
          <p className="text-secondary-600 dark:text-secondary-400 mb-6">
            {error}
          </p>
          <Button variant="primary" onClick={() => navigate('/lobby')}>
            Voltar para o Lobby
          </Button>
        </div>
      </div>
    );
  }

  if (!recording) {
    return null;
  }

  const videoUrl = `${API_URL}/recordings/${id}/stream`;

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/lobby')}
            className="mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Voltar para o Lobby
          </Button>

          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-white">
            Gravação de Partida
          </h1>
        </div>

        {/* Video Player */}
        <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
            <video
              src={videoUrl}
              controls
              className="absolute top-0 left-0 w-full h-full"
              preload="metadata"
            >
              Seu navegador não suporta reprodução de vídeo.
            </video>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Info Card */}
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
              Informações
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-400">
                  Duração:
                </span>
                <span className="font-medium text-secondary-900 dark:text-white">
                  {formatDuration(recording.duration)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-400">
                  Visualizações:
                </span>
                <span className="font-medium text-secondary-900 dark:text-white">
                  {recording.views.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-400">
                  Data:
                </span>
                <span className="font-medium text-secondary-900 dark:text-white">
                  {formatDistanceToNow(new Date(recording.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary-600 dark:text-secondary-400">
                  Formato:
                </span>
                <span className="font-medium text-secondary-900 dark:text-white uppercase">
                  {recording.format}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
              Ações
            </h2>
            <div className="space-y-3">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleShare}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Compartilhar
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownload}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Baixar Vídeo
              </Button>
            </div>
          </div>
        </div>

        {/* Expiration Notice */}
        {recording.expiresAt && (
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
              <p className="text-sm text-warning-700 dark:text-warning-300">
                Esta gravação expira{' '}
                {formatDistanceToNow(new Date(recording.expiresAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
                . Baixe agora se quiser mantê-la permanentemente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Watch;
