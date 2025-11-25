import { useState, useRef, useEffect } from 'react';
import Button from './Button.jsx';

/**
 * ChatInput - Componente de input para enviar mensagens no chat
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {Function} props.onSend - Função chamada ao enviar mensagem (recebe message como parâmetro)
 * @param {boolean} [props.disabled=false] - Se o input está desabilitado
 * @param {string} [props.placeholder='Digite sua mensagem...'] - Placeholder do input
 * @param {number} [props.maxLength=500] - Tamanho máximo da mensagem
 *
 * @example
 * <ChatInput
 *   onSend={(message) => console.log(message)}
 *   disabled={false}
 *   placeholder="Digite sua mensagem..."
 * />
 */
const ChatInput = ({ onSend, disabled = false, placeholder = 'Digite sua mensagem...', maxLength = 500 }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Focar no input quando o componente montar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = e => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      setError('Mensagem não pode estar vazia');
      return;
    }

    if (trimmedMessage.length > maxLength) {
      setError(`Mensagem deve ter no máximo ${maxLength} caracteres`);
      return;
    }

    setError('');
    onSend(trimmedMessage);
    setMessage('');
    
    // Focar novamente no input após enviar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = e => {
    // Permitir Enter para enviar, mas Shift+Enter para nova linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars < 50;

  return (
    <form onSubmit={handleSubmit} className="border-t border-secondary-200 dark:border-secondary-700 p-4">
      {error && (
        <p className="text-sm text-error-600 dark:text-error-400 mb-2">{error}</p>
      )}
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={1}
            className="w-full px-4 py-2 rounded-lg border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-gray-800 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
            onInput={e => {
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />
          
          {isNearLimit && (
            <span className={`absolute bottom-2 right-2 text-xs ${remainingChars < 10 ? 'text-error-600 dark:text-error-400' : 'text-secondary-500 dark:text-secondary-400'}`}>
              {remainingChars}
            </span>
          )}
        </div>
        
        <Button
          type="submit"
          disabled={disabled || !message.trim()}
          className="self-end"
        >
          Enviar
        </Button>
      </div>
    </form>
  );
};

export default ChatInput;

