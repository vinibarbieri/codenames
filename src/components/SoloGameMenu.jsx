import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import Modal from './Modal';
import api from '../services/api.js';
// Removemos a importação do api que estava causando erro
// import api from '../services/api'; 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const SoloGameMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMode, setSelectedMode] = useState('bot-spymaster');
  const [difficulty, setDifficulty] = useState('medium');
  const [team, setTeam] = useState('red');

 const handleCreateGame = async () => {
  try {
    setLoading(true);
    setError('');

    const token = api.getToken();

    console.log("Aqui")
    console.log("API_URL = ", API_URL);

    const response = await fetch(`${API_URL}/games/solo/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        mode: selectedMode,
        difficulty,
        team,
      }),
    });

    const text = await response.text();
    console.log(response)

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Resposta inválida do servidor');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar partida');
    }

    const gameId = data.data?._id || data.data?.id;
    onClose();
    navigate(`/game/${gameId}`);

  } catch (err) {
    console.error('Erro ao criar jogo solo:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const modes = [
    {
      id: 'bot-spymaster',
      title: '🤖 Bot dá Dicas',
      description: 'Você adivinha as palavras com base nas dicas do bot',
      icon: '🎯',
    },
    {
      id: 'bot-operative',
      title: '🎨 Você dá Dicas',
      description: 'Você é o spymaster e o bot tenta adivinhar',
      icon: '🧠',
    },
  ];

  // CORREÇÃO TAILWIND: Mapeamento de cores explícito para evitar purge
  const difficultyStyles = {
    easy: { 
      active: 'border-green-500 bg-green-50 dark:bg-green-900/20', 
      icon: '😊' 
    },
    medium: { 
      active: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', 
      icon: '😐' 
    },
    hard: { 
      active: 'border-red-500 bg-red-50 dark:bg-red-900/20', 
      icon: '😈' 
    }
  };

  const difficulties = [
    { id: 'easy', label: 'Fácil' },
    { id: 'medium', label: 'Médio' },
    { id: 'hard', label: 'Difícil' },
  ];

  const teams = [
    { id: 'red', label: 'Equipe Vermelha', colorClass: 'bg-red-500' },
    { id: 'blue', label: 'Equipe Azul', colorClass: 'bg-blue-500' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🎮 Jogar com Bot"
      size="lg"
    >
      <div className="space-y-6">
        {/* Modo de Jogo */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-secondary-900 dark:text-white">
            Escolha o Modo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedMode === mode.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{mode.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-secondary-900 dark:text-white mb-1">
                      {mode.title}
                    </h4>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                      {mode.description}
                    </p>
                  </div>
                  {selectedMode === mode.id && (
                    <span className="text-primary-500">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dificuldade */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-secondary-900 dark:text-white">
            Dificuldade
          </h3>
          <div className="flex gap-2">
            {difficulties.map(diff => (
              <button
                key={diff.id}
                onClick={() => setDifficulty(diff.id)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  difficulty === diff.id
                    ? difficultyStyles[diff.id].active
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-secondary-400'
                }`}
              >
                <div className="text-2xl mb-1">{difficultyStyles[diff.id].icon}</div>
                <div className="text-sm font-medium text-secondary-900 dark:text-white">
                  {diff.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Equipe */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-secondary-900 dark:text-white">
            Sua Equipe
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setTeam(t.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  team === t.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center gap-2 justify-center">
                  <div className={`w-4 h-4 rounded-full ${t.colorClass}`} />
                  <span className="font-medium text-secondary-900 dark:text-white">
                    {t.label}
                  </span>
                  {team === t.id && (
                    <span className="text-primary-500 ml-auto">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateGame}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Criando...' : 'Começar Partida'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SoloGameMenu;