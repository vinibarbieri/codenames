import GameCard from './GameCard';

/**
 * GameBoard - Componente de tabuleiro 5x5 do jogo Codenames
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {Array} props.cards - Array de 25 cartas {word, revealed, type}
 * @param {function} props.onCardClick - Callback ao clicar em uma carta (recebe index)
 * @param {boolean} [props.disabled=false] - Se o tabuleiro está desabilitado
 * @param {number} [props.shakingCardIndex=null] - Índice da carta que deve animar shake
 * @param {boolean} [props.showTypes=false] - Se deve mostrar os tipos das cartas (para spymasters)
 *
 * @example
 * <GameBoard
 *   cards={gameBoard}
 *   onCardClick={(index) => handleGuess(index)}
 *   disabled={false}
 *   showTypes={true}
 * />
 */
const GameBoard = ({ cards, onCardClick, disabled = false, shakingCardIndex = null, showTypes = false }) => {
  if (!cards || cards.length !== 25) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Carregando tabuleiro...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4">
        {cards.map((card, index) => (
          <GameCard
            key={index}
            word={card.word}
            revealed={card.revealed || false}
            type={card.type || 'hidden'}
            onClick={() => onCardClick(index)}
            disabled={disabled}
            isShaking={shakingCardIndex === index}
            showType={showTypes}
          />
        ))}
      </div>
    </div>
  );
};

export default GameBoard;

