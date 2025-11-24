import { useParams } from 'react-router-dom';

const Game = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">Partida</h1>
      <p className="mt-4">ID da partida: {id}</p>
      <p className="mt-2">Página de jogo em desenvolvimento...</p>
    </div>
  );
};

export default Game;
