import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopPlayers();
  }, []);

  const fetchTopPlayers = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/ranking?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTopPlayers(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
      // Mock data for development
      setTopPlayers([
        { id: 1, nickname: 'Player1', score: 1500, avatar: '' },
        { id: 2, nickname: 'Player2', score: 1450, avatar: '' },
        { id: 3, nickname: 'Player3', score: 1400, avatar: '' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayNow = () => {
    if (isAuthenticated) {
      navigate('/lobby');
    } else {
      navigate('/login');
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Hero Section */}
        <div className="container mx-auto px-4 pt-20 pb-12">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo */}
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl font-bold text-primary-600 dark:text-primary-400 mb-4">
                Codenames
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300">
                Jogue online com amigos e jogadores do mundo todo!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button
                variant="primary"
                size="lg"
                onClick={handlePlayNow}
                className="w-full sm:w-auto px-8"
              >
                Jogar Agora
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto px-8"
                >
                  Cadastrar
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowTutorial(true)}
                className="w-full sm:w-auto px-8"
              >
                Como Jogar
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <Card padding="lg" hover>
                <div className="text-center">
                  <div className="text-4xl mb-4">🎮</div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                    Jogue Online
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Partidas em tempo real com jogadores do mundo todo
                  </p>
                </div>
              </Card>

              <Card padding="lg" hover>
                <div className="text-center">
                  <div className="text-4xl mb-4">🏆</div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                    Ranking Global
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Compete e suba no ranking internacional
                  </p>
                </div>
              </Card>

              <Card padding="lg" hover>
                <div className="text-center">
                  <div className="text-4xl mb-4">👥</div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                    Jogue em Equipe
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Forme equipes e trabalhe junto para vencer
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Top 10 Ranking */}
        <div className="container mx-auto px-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <Card padding="lg">
              <h2 className="text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
                🏆 Top 10 Jogadores
              </h2>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader size="lg" />
                </div>
              ) : topPlayers.length > 0 ? (
                <div className="space-y-3">
                  {topPlayers.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 w-8">
                        #{index + 1}
                      </div>
                      <Avatar
                        src={player.avatar}
                        name={player.nickname}
                        size="md"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {player.nickname}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-accent-600 dark:text-accent-400">
                        {player.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                  Nenhum jogador no ranking ainda. Seja o primeiro!
                </p>
              )}

              <div className="mt-6 text-center">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/ranking')}
                >
                  Ver Ranking Completo →
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Tutorial Modal */}
        <Modal
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
          title="Como Jogar Codenames"
          size="lg"
        >
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                Objetivo do Jogo
              </h3>
              <p>
                Codenames é um jogo de dedução em equipe. Duas equipes (Vermelha e Azul)
                competem para encontrar todas as suas palavras-código primeiro.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                Papéis
              </h3>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Spymaster:</strong> Dá dicas de uma palavra e um número para
                  ajudar seu time a encontrar as palavras corretas.
                </li>
                <li>
                  <strong>Operativo:</strong> Tenta adivinhar as palavras baseado nas
                  dicas do Spymaster.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                Como Jogar
              </h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>O Spymaster dá uma dica relacionada a uma ou mais palavras.</li>
                <li>Os operativos discutem e escolhem uma palavra para revelar.</li>
                <li>
                  Se acertarem uma palavra da sua equipe, podem continuar tentando.
                </li>
                <li>
                  Se errarem (palavra neutra, do adversário ou assassino), o turno passa
                  para o outro time.
                </li>
                <li>
                  ⚠️ <strong>Cuidado:</strong> Se revelarem o assassino, perdem
                  imediatamente!
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                Vitória
              </h3>
              <p>
                A primeira equipe a revelar todas as suas palavras-código vence a
                partida!
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => setShowTutorial(false)}>
              Entendi!
            </Button>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default LandingPage;
