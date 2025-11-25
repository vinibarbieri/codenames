import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';
import QueueStatus from '../components/QueueStatus';
import ChatBox from '../components/ChatBox';
import socket from '../services/socket';

const Lobby = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentMatches, setRecentMatches] = useState([]);
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Garantir que o socket tenha userId quando conectar
  useEffect(() => {
    if (socket.connected && user?.id && !socket.userId) {
      socket.userId = user.id || user._id;
    }
  }, [user, socket.connected]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch recent matches from API
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const matchesResponse = await fetch(
            `${import.meta.env.VITE_API_URL}/users/me/matches/recent`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (matchesResponse.ok) {
            const matchesResult = await matchesResponse.json();
            setRecentMatches(matchesResult.data || []);
          }
        } catch (error) {
          console.warn('Erro ao buscar partidas recentes:', error);
          setRecentMatches([]);
        }
      }

      // Fetch top 10 ranking
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/ranking?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTopPlayers(data.data || []);
      } else {
        // Mock data fallback
        setTopPlayers([
          { id: 1, nickname: 'Player1', score: 1500, avatar: '' },
          { id: 2, nickname: 'Player2', score: 1450, avatar: '' },
          { id: 3, nickname: 'Player3', score: 1400, avatar: '' },
        ]);
      }

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };


  const handlePlayVsBot = () => {
    // TODO: Implement bot game creation
    alert('Funcionalidade em desenvolvimento');
  };


  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader size="xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Profile & Queue */}
            <div className="lg:col-span-3 space-y-6">
              {/* User Profile Card */}
              <Card padding="lg">
                <div className="text-center">
                  <Avatar
                    src={user?.avatar}
                    name={user?.nickname || user?.email}
                    size="xl"
                    className="mx-auto mb-4"
                  />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {user?.nickname || 'Jogador'}
                  </h2>
                  <div className="flex justify-center items-center gap-2 text-accent-600 dark:text-accent-400 mb-4">
                    <span className="text-2xl font-bold">{user?.score || 0}</span>
                    <span className="text-sm">pontos</span>
                  </div>
                  {user?.location?.city && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📍 {user.location.city}, {user.location.state}
                    </p>
                  )}
                </div>
              </Card>

              {/* Queue Card */}
              <Card padding="lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Fila de Partidas
                </h3>
                <QueueStatus />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handlePlayVsBot}
                  >
                    🤖 Jogar vs Bot
                  </Button>
                </div>
              </Card>

              {/* Top 10 Ranking Sidebar */}
              <Card padding="lg">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  🏆 Top 10
                </h3>
                <div className="space-y-2">
                  {topPlayers.slice(0, 10).map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => navigate(`/profile/${player.id}`)}
                    >
                      <div className="text-sm font-bold text-primary-600 dark:text-primary-400 w-6">
                        #{index + 1}
                      </div>
                      <Avatar src={player.avatar} name={player.nickname} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {player.nickname}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-accent-600 dark:text-accent-400">
                        {player.score}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  size="sm"
                  onClick={() => navigate('/ranking')}
                >
                  Ver Ranking Completo →
                </Button>
              </Card>
            </div>

            {/* Center Column - Recent Matches */}
            <div className="lg:col-span-6 space-y-6">
              <Card padding="lg">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  Partidas Recentes
                </h2>
                <div className="space-y-3">
                  {recentMatches.length > 0 ? (
                    recentMatches.map(match => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        onClick={() => navigate(`/game/${match.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl">
                            {match.result === 'Vitória' ? '🏆' : '😔'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              vs {match.opponent}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {match.date}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-bold ${
                              match.result === 'Vitória'
                                ? 'text-success-600 dark:text-success-400'
                                : 'text-error-600 dark:text-error-400'
                            }`}
                          >
                            {match.result}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            +{match.score} pts
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                      Você ainda não jogou nenhuma partida. Entre na fila para começar!
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column - Chat */}
            <div className="lg:col-span-3">
              <div className="h-[600px]">
                <ChatBox
                  type="general"
                  user={user}
                  socket={socket}
                  isOpen={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Lobby;
