import { useState } from 'react';
import Input from './Input';
import Button from './Button';

/**
 * ClueInput - Componente para entrada de dica do spymaster
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {function} props.onSubmit - Callback ao submeter dica (recebe {word, number})
 * @param {boolean} [props.disabled=false] - Se o input está desabilitado
 * @param {string} [props.currentClue=''] - Dica atual exibida
 * @param {number} [props.remainingGuesses=0] - Palpites restantes
 *
 * @example
 * <ClueInput
 *   onSubmit={(clue) => handleClueSubmit(clue)}
 *   disabled={!isSpymaster || !isMyTurn}
 *   currentClue="BANANA"
 *   remainingGuesses={2}
 * />
 */
const ClueInput = ({ onSubmit, disabled = false, currentClue = '', remainingGuesses = 0 }) => {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    setError('');

    // Validação
    if (!word.trim()) {
      setError('A palavra não pode estar vazia');
      return;
    }

    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(word.trim())) {
      setError('A palavra deve conter apenas letras');
      return;
    }

    const num = parseInt(number, 10);
    if (!num || num < 1 || num > 9) {
      setError('O número deve estar entre 1 e 9');
      return;
    }

    onSubmit({ word: word.trim(), number: num });
    setWord('');
    setNumber('');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {currentClue && (
        <div className="mb-4 p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <p className="text-sm text-primary-700 dark:text-primary-300">
            Dica atual: <span className="font-bold">{currentClue}</span>
          </p>
          {remainingGuesses > 0 && (
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
              Palpites restantes: {remainingGuesses}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Palavra da dica"
            value={word}
            onChange={e => setWord(e.target.value)}
            disabled={disabled}
            className="flex-1"
            maxLength={50}
          />
          <Input
            type="number"
            placeholder="Nº"
            value={number}
            onChange={e => {
              const val = e.target.value;
              if (val === '' || (parseInt(val, 10) >= 1 && parseInt(val, 10) <= 9)) {
                setNumber(val);
              }
            }}
            disabled={disabled}
            className="w-20"
            min="1"
            max="9"
          />
        </div>

        {error && <p className="text-sm text-error-600 dark:text-error-400">{error}</p>}

        <Button type="submit" disabled={disabled || !word.trim() || !number} variant="primary" className="w-full">
          Enviar Dica
        </Button>

        {disabled && (
          <p className="text-xs text-secondary-500 dark:text-secondary-400 text-center">
            {currentClue ? 'Aguarde o próximo turno' : 'Apenas o spymaster pode dar dicas no turno da sua equipe'}
          </p>
        )}
      </form>
    </div>
  );
};

export default ClueInput;

