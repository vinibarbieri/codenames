import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Loader from '../components/Loader';
import Avatar from '../components/Avatar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const Watch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchRecording = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/recordings/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Gravação não encontrada');
        } else if (response.status === 410) {
          throw new Error('Esta gravação expirou e não está mais disponível');
        }
        throw new Error('Erro ao carregar gravação');
      }

      const result = await response.json();
      setRecording(result.data);
    } catch (err) {
      console.error('Error fetching recording:', err);
      setError(err.message || 'Erro ao carregar gravação');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecording();
  }, [fetchRecording]);

  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setError('Erro ao copiar URL');
    }
  };

  const handleDownload = () => {
    const url = `${API_URL}/recordings/${id}/stream`;
    const token = localStorage.getItem('token');
    
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => response.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = recording?.filename || 'recording.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch((err) => {
        console.error('Error downloading:', err);
        setError('Erro ao baixar vídeo');
      });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader size="xl" />
            <p className="mt-4 text-secondary-600 dark:text-secondary-400">
              Carregando gravação...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !recording) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <p className="text-error-600 dark:text-error-400 mb-4 text-lg">
              {error || 'Gravação não encontrada'}
            </p>
            <Button variant="primary" onClick={() => navigate('/lobby')}>
              Voltar para Lobby
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const game = recording.gameId;

  // Extrair jogadores e pontuação do jogo
  const redTeam = game?.players?.filter((p) => p.team === 'red') || [];
  const blueTeam = game?.players?.filter((p) => p.team === 'blue') || [];
  const winner = game?.winner;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/lobby')}
              className="mb-4"
            >
              ← Voltar para Lobby
            </Button>
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
              Gravação da Partida
            </h1>
            <p className="text-secondary-600 dark:text-secondary-400">
              {formatDate(recording.createdAt)}
            </p>
          </div>

          {/* Video Player */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-6">
            <div className="w-full" style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <video
                controls
                className="w-full h-auto"
                style={{ maxHeight: '70vh' }}
                preload="metadata"
              >
                <source
                  src={`${API_URL}/recordings/${id}/stream`}
                  type="video/webm"
                />
                Seu navegador não suporta o elemento de vídeo.
              </video>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
              Informações da Partida
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Red Team */}
              <div>
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
                  Equipe Vermelha
                  {winner === 'red' && ' 🏆'}
                </h3>
                <div className="space-y-2">
                  {redTeam.map((player, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20"
                    >
                      <Avatar
                        src={player.userId?.avatar}
                        name={player.userId?.nickname || 'Jogador'}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                          {player.userId?.nickname || 'Jogador'}
                        </p>
                        <p className="text-xs text-secondary-600 dark:text-secondary-400">
                          {player.role === 'spymaster' ? 'Espião Mestre' : 'Operativo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blue Team */}
              <div>
                <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">
                  Equipe Azul
                  {winner === 'blue' && ' 🏆'}
                </h3>
                <div className="space-y-2">
                  {blueTeam.map((player, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20"
                    >
                      <Avatar
                        src={player.userId?.avatar}
                        name={player.userId?.nickname || 'Jogador'}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                          {player.userId?.nickname || 'Jogador'}
                        </p>
                        <p className="text-xs text-secondary-600 dark:text-secondary-400">
                          {player.role === 'spymaster' ? 'Espião Mestre' : 'Operativo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400">
                  Duração
                </p>
                <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                  {formatDuration(recording.duration)}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400">
                  Visualizações
                </p>
                <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                  {recording.views}
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400">
                  Tamanho
                </p>
                <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                  {(recording.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400">
                  Status
                </p>
                <p className="text-lg font-semibold text-secondary-900 dark:text-white">
                  {game?.status === 'finished' ? 'Finalizada' : 'Em andamento'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" onClick={handleShare} className="flex-1">
              {copied ? '✓ URL Copiada!' : '📋 Compartilhar'}
            </Button>
            <Button variant="outline" onClick={handleDownload} className="flex-1">
              ⬇️ Download
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/lobby')}
              className="flex-1"
            >
              Voltar para Lobby
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Watch;
