import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Loader from '../components/Loader';
import Modal from '../components/Modal';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPagination, setUsersPagination] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);
  const [configValue, setConfigValue] = useState('');

  const API_URL = import.meta.env.VITE_API_URL;


  const getToken = () => {
    return localStorage.getItem('token');
  };

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        limit: '20',
      });
      if (usersSearch) {
        params.append('search', usersSearch);
      }

      const response = await fetch(`${API_URL}/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
        setUsersPagination(data.pagination);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  }, [API_URL, usersPage, usersSearch]);

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/config`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigs(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar configs:', error);
    }
  }, [API_URL]);

  useEffect(() => {
    // Verificar se é admin
    if (user && user.role !== 'admin') {
      navigate('/lobby');
      return;
    }

    if (user?.role === 'admin') {
      fetchStats();
      fetchConfigs();
    }
  }, [user, navigate, fetchStats, fetchConfigs]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${userToDelete._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.message || 'Erro ao deletar usuário');
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      alert('Erro ao deletar usuário');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.message || 'Erro ao atualizar role');
      }
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      alert('Erro ao atualizar role');
    }
  };

  const handleEditConfig = config => {
    setEditingConfig(config);
    setConfigValue(
      typeof config.value === 'object' ? JSON.stringify(config.value) : config.value.toString()
    );
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;

    try {
      let value = configValue;
      // Tentar fazer parse se for JSON
      try {
        value = JSON.parse(configValue);
      } catch {
        // Se não for JSON, tentar converter para número se possível
        if (!isNaN(configValue) && configValue !== '') {
          value = Number(configValue);
        } else if (configValue === 'true' || configValue === 'false') {
          value = configValue === 'true';
        }
      }

      const response = await fetch(`${API_URL}/admin/config/${editingConfig.key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        setEditingConfig(null);
        setConfigValue('');
        fetchConfigs();
      } else {
        const data = await response.json();
        alert(data.message || 'Erro ao atualizar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar config:', error);
      alert('Erro ao salvar configuração');
    }
  };

  const formatBytes = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader />
        </div>
      </Layout>
    );
  }

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Painel Administrativo
            </h1>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              {['dashboard', 'users', 'config'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab === 'dashboard' && 'Dashboard'}
                  {tab === 'users' && 'Usuários'}
                  {tab === 'config' && 'Configurações'}
                </button>
              ))}
            </nav>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card padding="lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  Total de Usuários
                </h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalUsers}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {stats.activeUsers} online
                </p>
              </Card>

              <Card padding="lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  Partidas
                </h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.totalGames}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {stats.gamesToday} hoje
                </p>
              </Card>

              <Card padding="lg">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  Vídeos
                </h3>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalRecordings}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatBytes(stats.storageUsed)} usado
                </p>
              </Card>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Buscar por nickname ou email..."
                  value={usersSearch}
                  onChange={e => {
                    setUsersSearch(e.target.value);
                    setUsersPage(1);
                  }}
                  className="max-w-md"
                />
              </div>

              <Card padding="lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {users.map(userItem => (
                        <tr key={userItem._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {userItem.nickname}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {userItem.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={userItem.role}
                              onChange={e => handleUpdateRole(userItem._id, e.target.value)}
                              className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:text-white"
                            >
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setUserToDelete(userItem);
                                setShowDeleteModal(true);
                              }}
                              disabled={userItem._id === user?._id}
                            >
                              Deletar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {usersPagination.pages > 1 && (
                  <div className="mt-4 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                    >
                      Anterior
                    </Button>
                    <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      Página {usersPagination.page} de {usersPagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage(p => Math.min(usersPagination.pages, p + 1))}
                      disabled={usersPage === usersPagination.pages}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && (
            <Card padding="lg">
              <div className="space-y-4">
                {configs.map(config => (
                  <div
                    key={config._id}
                    className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {config.key}
                      </h4>
                      {config.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {config.description}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        Valor atual: <code>{JSON.stringify(config.value)}</code>
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleEditConfig(config)}
                    >
                      Editar
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete User Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        title="Confirmar Exclusão"
      >
        <p className="mb-4">
          Tem certeza que deseja deletar o usuário <strong>{userToDelete?.nickname}</strong>? Esta
          ação não pode ser desfeita.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteUser}>
            Deletar
          </Button>
        </div>
      </Modal>

      {/* Edit Config Modal */}
      <Modal
        isOpen={!!editingConfig}
        onClose={() => {
          setEditingConfig(null);
          setConfigValue('');
        }}
        title={`Editar Config: ${editingConfig?.key}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Valor
            </label>
            <Input
              type="text"
              value={configValue}
              onChange={e => setConfigValue(e.target.value)}
              placeholder="Digite o novo valor"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use true/false para boolean, números para números, ou JSON para objetos
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditingConfig(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveConfig}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default Admin;
