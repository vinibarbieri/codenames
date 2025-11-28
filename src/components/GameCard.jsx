import { useState } from 'react';

/**
 * GameCard - Componente de carta do jogo Codenames
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} props.word - Palavra da carta
 * @param {boolean} props.revealed - Se a carta foi revelada
 * @param {'red'|'blue'|'neutral'|'assassin'|'hidden'} props.type - Tipo da carta
 * @param {function} props.onClick - Callback ao clicar na carta
 * @param {boolean} [props.disabled=false] - Se a carta está desabilitada
 * @param {boolean} [props.isShaking=false] - Se deve animar shake (erro)
 * @param {boolean} [props.showType=false] - Se deve mostrar o tipo mesmo quando não revelado (para spymasters)
 *
 * @example
 * <GameCard
 *   word="BANANA"
 *   revealed={false}
 *   type="red"
 *   onClick={() => handleCardClick(0)}
 *   disabled={false}
 *   showType={true}
 * />
 */
const GameCard = ({ word, revealed, type, onClick, disabled = false, isShaking = false, showType = false }) => {
  const [isFlipping, setIsFlipping] = useState(false);

  // Cores de fundo para cada tipo de carta quando revelada
  const typeColors = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    neutral: 'bg-gray-500',
    assassin: 'bg-black',
    hidden: 'bg-amber-100 dark:bg-amber-900',
  };

  // Cores de texto para cada tipo
  const typeTextColors = {
    red: 'text-white',
    blue: 'text-white',
    neutral: 'text-gray-800',
    assassin: 'text-white',
    hidden: 'text-amber-900 dark:text-amber-100',
  };

  const handleClick = () => {
    if (disabled || revealed) return;

    // Animar flip ao clicar
    setIsFlipping(true);
    setTimeout(() => {
      setIsFlipping(false);
      onClick?.();
    }, 300);
  };

  // Se showType é true (spymaster), mostrar o tipo mesmo quando não revelado
  // Caso contrário, só mostrar tipo se estiver revelado
  const cardType = (revealed || showType) && type !== 'hidden' ? type : 'hidden';
  const bgColor = typeColors[cardType] || typeColors.hidden;
  const textColor = typeTextColors[cardType] || typeTextColors.hidden;
  
  // Para spymasters: cartas não selecionadas = cores vivas (100%), cartas selecionadas = mais ocultas (opacidade reduzida)
  const isRevealedForSpymaster = revealed && showType;
  const revealedOpacityForSpymaster = isRevealedForSpymaster ? 'opacity-60' : '';
  

  return (
    <button
      onClick={handleClick}
      disabled={disabled || revealed}
      className={`
        relative w-full aspect-square rounded-lg border-2 transition-all duration-300
        ${revealed ? `${bgColor} ${textColor} border-gray-600 ${revealedOpacityForSpymaster}` : showType ? `${bgColor} ${textColor} border-gray-400` : 'bg-amber-700 dark:bg-amber-900 border-amber-900 dark:border-amber-700 text-amber-900 dark:text-amber-100'}
        ${disabled || revealed ? `cursor-not-allowed` : 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95'}
        ${isFlipping ? 'animate-flip' : ''}
        ${isShaking ? 'animate-shake' : ''}
        flex items-center justify-center p-2 font-semibold text-sm sm:text-white
      `}
    >
      <span className="text-center break-words">{word}</span>
      {(revealed || (showType && type !== 'hidden')) && (
        <div className="absolute top-1 right-1 text-xs opacity-75">
          {type === 'red' && '🔴'}
          {type === 'blue' && '🔵'}
          {type === 'neutral' && '⚪'}
          {type === 'assassin' && '💀'}
        </div>
      )}
    </button>
  );
};

export default GameCard;

