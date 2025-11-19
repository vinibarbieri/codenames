import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-800">Codenames</h1>
            <button onClick={handleLogout} className="btn-secondary">
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Bem-vindo, {user?.nickname || 'Jogador'}!
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Seu Perfil</h3>
              <div className="space-y-2 text-gray-600">
                <p>
                  <span className="font-medium">Email:</span> {user?.email}
                </p>
                <p>
                  <span className="font-medium">Idade:</span> {user?.age}
                </p>
                {user?.location?.city && (
                  <p>
                    <span className="font-medium">Localização:</span>{' '}
                    {[user.location.city, user.location.state, user.location.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                <p>
                  <span className="font-medium">Pontuação:</span> {user?.score || 0}
                </p>
                <p>
                  <span className="font-medium">Função:</span> {user?.role || 'usuário'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Ações Rápidas</h3>
              <div className="space-y-2">
                <button className="btn-primary w-full">Criar Sala</button>
                <button className="btn-secondary w-full">Entrar em Sala</button>
                <button className="btn-secondary w-full">Ver Classificação</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
