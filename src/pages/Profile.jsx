import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import Input from '../components/Input';

const Profile = () => {
  const { id } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [matches, setMatches] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editForm, setEditForm] = useState({
    nickname: '',
    city: '',
    state: '',
    country: '',
    avatar: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const matchesPerPage = 10;

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data from API
      const userResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/users/${id}`
      );

      if (!userResponse.ok) {
        throw new Error('Erro ao buscar dados do usuário');
      }

      const userResult = await userResponse.json();
      const userData = userResult.data;

      // Fetch stats from API
      let statsData = {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgScore: 0,
        currentStreak: 0,
        bestStreak: 0,
      };

      try {
        const statsResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/users/${id}/stats`
        );
        if (statsResponse.ok) {
          const statsResult = await statsResponse.json();
          statsData = statsResult.data;
        }
      } catch (error) {
        console.warn('Erro ao buscar estatísticas:', error);
      }

      // Fetch match history from API
      let matchHistory = [];
      try {
        const matchesResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/users/${id}/matches`
        );
        if (matchesResponse.ok) {
          const matchesResult = await matchesResponse.json();
          matchHistory = matchesResult.data.matches || [];
        }
      } catch (error) {
        console.warn('Erro ao buscar histórico de partidas:', error);
      }

      // Fetch recordings (mock for now - TODO: implement when recording system is ready)
      const recordingsList = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        title: `Partida épica #${i + 1}`,
        thumbnail: '',
        date: new Date(Date.now() - i * 172800000).toLocaleDateString('pt-BR'),
        views: Math.floor(Math.random() * 1000),
      }));

      setUser({
        id: userData.id,
        nickname: userData.nickname,
        email: isOwnProfile ? userData.email : undefined,
        avatar: userData.avatar || '',
        score: userData.score || 0,
        role: userData.role || 'user',
        location: userData.location || {
          city: '',
          state: '',
          country: '',
        },
      });
      setStats(statsData);
      setMatches(matchHistory);
      setRecordings(recordingsList);
      setEditForm({
        nickname: userData.nickname,
        city: userData.location?.city || '',
        state: userData.location?.state || '',
        country: userData.location?.country || '',
        avatar: userData.avatar || '',
      });
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async e => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const profileData = {
        nickname: editForm.nickname,
        city: editForm.city,
        state: editForm.state,
        country: editForm.country,
        avatar: editForm.avatar,
      };

      const response = await userAPI.updateProfile(id, profileData);

      if (response.success && response.data) {
        // Update local user state
        const updatedUser = response.data;
        const newUserState = {
          ...user,
          nickname: updatedUser.nickname,
          avatar: updatedUser.avatar || '',
          location: updatedUser.location || {
            city: '',
            state: '',
            country: '',
          },
        };
        setUser(newUserState);

        // Update global AuthContext state if editing own profile
        if (isOwnProfile && updateUser) {
          updateUser({
            nickname: updatedUser.nickname,
            avatar: updatedUser.avatar || '',
            location: updatedUser.location || {
              city: '',
              state: '',
              country: '',
            },
          });
        }

        // Close modal
        setShowEditModal(false);
      }
    } catch (err) {
      setError(err.message || 'Erro ao atualizar perfil');
      console.error('Erro ao atualizar perfil:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = e => {
    const file = e.target.files?.[0];
    if (file) {
      // TODO: Implement avatar upload with FormData
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
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

  // Pagination
  const indexOfLastMatch = currentPage * matchesPerPage;
  const indexOfFirstMatch = indexOfLastMatch - matchesPerPage;
  const currentMatches = matches.slice(indexOfFirstMatch, indexOfLastMatch);
  const totalPages = Math.ceil(matches.length / matchesPerPage);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          {/* Profile Header */}
          <Card padding="lg" className="mb-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar
                src={user?.avatar}
                name={user?.nickname}
                size="2xl"
                className="flex-shrink-0"
              />
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {user?.nickname}
                </h1>
                {user?.email && isOwnProfile && (
                  <p className="text-gray-600 dark:text-gray-400 mb-2">{user.email}</p>
                )}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-accent-600 dark:text-accent-400">
                      {user?.score}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      pontos
                    </span>
                  </div>
                  {user?.location?.city && (
                    <p className="text-gray-600 dark:text-gray-400">
                      📍 {user.location.city}, {user.location.state},{' '}
                      {user.location.country}
                    </p>
                  )}
                  <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-semibold">
                    {user?.role}
                  </span>
                </div>
                {isOwnProfile && (
                  <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                    Editar Perfil
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Statistics */}
          <Card padding="lg" className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              📊 Estatísticas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                  {stats?.totalMatches}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total de Partidas
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-success-600 dark:text-success-400 mb-1">
                  {stats?.wins}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Vitórias</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-error-600 dark:text-error-400 mb-1">
                  {stats?.losses}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Derrotas</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-accent-600 dark:text-accent-400 mb-1">
                  {stats?.winRate}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Taxa de Vitória</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-warning-600 dark:text-warning-400 mb-1">
                  {stats?.avgScore}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Média de Pontos
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-3xl font-bold text-secondary-600 dark:text-secondary-400 mb-1">
                  {stats?.currentStreak}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Sequência Atual
                </div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                  🔥 {stats?.bestStreak}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Melhor Sequência
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Match History */}
            <Card padding="lg">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                📜 Histórico de Partidas
              </h2>
              <div className="space-y-2 mb-4">
                {currentMatches.map(match => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => navigate(`/game/${match.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xl">
                        {match.result === 'Vitória' ? '🏆' : '😔'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {match.isBotGame
                            ? 'com bot'
                            : `vs ${match.opponents && match.opponents.length > 0
                              ? match.opponents.length === 2
                                ? `${match.opponents[0].nickname} & ${match.opponents[1].nickname}`
                                : match.opponents[0].nickname
                              : match.opponent || 'Oponente'}`}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {match.date}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-bold text-sm ${
                          match.result === 'Vitória'
                            ? 'text-success-600 dark:text-success-400'
                            : 'text-error-600 dark:text-error-400'
                        }`}
                      >
                        {match.result}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        +{match.score} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Anterior
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima →
                  </Button>
                </div>
              )}
            </Card>

            {/* Recordings */}
            <Card padding="lg">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                🎬 Vídeos Gravados
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {recordings.length > 0 ? (
                  recordings.map(recording => (
                    <div
                      key={recording.id}
                      className="cursor-pointer group"
                      onClick={() => navigate(`/watch/${recording.id}`)}
                    >
                      <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 flex items-center justify-center group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors">
                        {recording.thumbnail ? (
                          <img
                            src={recording.thumbnail}
                            alt={recording.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-4xl">🎬</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {recording.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>{recording.date}</span>
                        <span>{recording.views} views</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-center text-gray-600 dark:text-gray-400 py-8">
                    Nenhum vídeo gravado ainda.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setError(null);
        }}
        title="Editar Perfil"
        size="md"
      >
        <form onSubmit={handleEditProfile} className="space-y-4">
          {error && (
            <div className="p-3 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg text-error-700 dark:text-error-300 text-sm">
              {error}
            </div>
          )}
          <div className="text-center mb-4">
            <Avatar
              src={editForm.avatar}
              name={editForm.nickname}
              size="xl"
              className="mx-auto mb-4"
            />
            <label className="cursor-pointer">
              <span className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                Alterar Foto
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          <Input
            label="Nickname"
            value={editForm.nickname}
            onChange={e => setEditForm({ ...editForm, nickname: e.target.value })}
            required
          />

          <Input
            label="Cidade"
            value={editForm.city}
            onChange={e => setEditForm({ ...editForm, city: e.target.value })}
          />

          <Input
            label="Estado"
            value={editForm.state}
            onChange={e => setEditForm({ ...editForm, state: e.target.value })}
          />

          <Input
            label="País"
            value={editForm.country}
            onChange={e => setEditForm({ ...editForm, country: e.target.value })}
          />

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowEditModal(false);
                setError(null);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default Profile;
