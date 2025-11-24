import { useParams } from 'react-router-dom';

const Watch = () => {
  const { id } = useParams();

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">Assistir Partida</h1>
      <p className="mt-4">ID da gravação: {id}</p>
      <p className="mt-2">Página de visualização em desenvolvimento...</p>
    </div>
  );
};

export default Watch;
