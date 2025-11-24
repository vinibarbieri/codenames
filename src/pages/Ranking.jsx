import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';
import Input from '../components/Input';
import Button from '../components/Button';

const Ranking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchRanking();
  }, [filter, debouncedSearch]);

  const fetchRanking = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '100');

      if (filter !== 'global') {
        if (filter === 'country') {
          params.append('country', user?.location?.country || 'Brasil');
        } else if (filter === 'state') {
          params.append('state', user?.location?.state || 'SP');
        }
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/ranking?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.data || []);
      } else {
        // Mock data for development
        const mockPlayers = Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          nickname: `Player${i + 1}`,
          score: 2000 - i * 15,
          avatar: '',
          location: {
            city: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte'][i % 3],
            state: ['SP', 'RJ', 'MG'][i % 3],
            country: 'Brasil',
          },
          stats: {
            totalMatches: Math.floor(Math.random() * 100) + 50,
            wins: Math.floor(Math.random() * 60) + 20,
            losses: Math.floor(Math.random() * 40) + 10,
            winRate: (Math.random() * 40 + 40).toFixed(1),
          },
        }));

        // Filter by search
        let filtered = mockPlayers;
        if (debouncedSearch) {
          filtered = mockPlayers.filter(p =>
            p.nickname.toLowerCase().includes(debouncedSearch.toLowerCase())
          );
        }

        // Filter by location
        if (filter === 'country') {
          filtered = filtered.filter(
            p => p.location.country === (user?.location?.country || 'Brasil')
          );
        } else if (filter === 'state') {
          filtered = filtered.filter(
            p => p.location.state === (user?.location?.state || 'SP')
          );
        }

        setPlayers(filtered);
      }
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = position => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <Card padding="lg">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                🏆 Ranking Global
              </h1>

              {/* Filters and Search */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={filter === 'global' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('global')}
                  >
                    🌍 Global
                  </Button>
                  <Button
                    variant={filter === 'country' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('country')}
                  >
                    🇧🇷 {user?.location?.country || 'Brasil'}
                  </Button>
                  <Button
                    variant={filter === 'state' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('state')}
                  >
                    📍 {user?.location?.state || 'SP'}
                  </Button>
                </div>

                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Buscar jogador..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    leftIcon={
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Ranking Table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader size="xl" />
              </div>
            ) : players.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Posição
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Jogador
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Localização
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Pontuação
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Partidas
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Win Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      const isCurrentUser = user?.id === player.id;
                      return (
                        <tr
                          key={player.id}
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                            isCurrentUser
                              ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/50'
                              : ''
                          }`}
                          onClick={() => navigate(`/profile/${player.id}`)}
                        >
                          <td className="py-4 px-4">
                            <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                              {getMedalEmoji(index + 1)}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={player.avatar}
                                name={player.nickname}
                                size="md"
                              />
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {player.nickname}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                                      (Você)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                            {player.location.city}, {player.location.state}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-lg text-accent-600 dark:text-accent-400">
                              {player.score}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center text-sm text-gray-600 dark:text-gray-400">
                            {player.stats.totalMatches}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`font-semibold ${
                                parseFloat(player.stats.winRate) >= 60
                                  ? 'text-success-600 dark:text-success-400'
                                  : parseFloat(player.stats.winRate) >= 50
                                    ? 'text-warning-600 dark:text-warning-400'
                                    : 'text-error-600 dark:text-error-400'
                              }`}
                            >
                              {player.stats.winRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {debouncedSearch
                    ? 'Nenhum jogador encontrado com esse nome.'
                    : 'Nenhum jogador no ranking ainda.'}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Ranking;
