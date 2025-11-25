import { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import Loader from './Loader.jsx';

/**
 * ChatBox - Componente principal do chat com lista de mensagens e input
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} props.type - Tipo de chat: 'general' ou 'game'
 * @param {string} [props.gameId] - ID do jogo (obrigatório se type='game')
 * @param {Object} props.user - Objeto do usuário atual {id, nickname, avatar}
 * @param {Object} props.socket - Instância do Socket.io
 * @param {boolean} [props.isOpen=true] - Se o chat está aberto
 * @param {Function} [props.onToggle] - Função chamada ao alternar visibilidade
 *
 * @example
 * <ChatBox
 *   type="general"
 *   user={{ id: '123', nickname: 'John', avatar: '/avatar.jpg' }}
 *   socket={socket}
 *   isOpen={true}
 * />
 */
const ChatBox = ({ type, gameId, user, socket, isOpen = true, onToggle }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  // Função para scroll automático (apenas se usuário estiver no fim)
  const scrollToBottom = useRef((force = false) => {
    if (messagesContainerRef.current) {
      if (force || isUserAtBottom) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  });

  // Atualizar a referência quando isUserAtBottom mudar
  useEffect(() => {
    scrollToBottom.current = (force = false) => {
      if (messagesContainerRef.current) {
        if (force || isUserAtBottom) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }
    };
  }, [isUserAtBottom]);

  // Verificar se usuário está no fim da lista
  const checkIfUserAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px de tolerância
      setIsUserAtBottom(isAtBottom);
    }
  };

  // Carregar histórico inicial
  useEffect(() => {
    if (!socket || !user?.id) return;

    const loadHistory = async () => {
      try {
        setLoading(true);
        setError('');

        // Solicitar histórico via Socket.io
        socket.emit('chat:history', { type, gameId, limit: 50 });

        // Escutar resposta
        const handleHistory = data => {
          if (data.messages) {
            setMessages(data.messages);
            setLoading(false);
            // Scroll para o fim após carregar histórico
            setTimeout(() => scrollToBottom.current(true), 100);
          }
        };

        socket.once('chat:history', handleHistory);
        socket.once('chat:error', errorData => {
          setError(errorData.message || 'Erro ao carregar histórico');
          setLoading(false);
        });
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        setError('Erro ao carregar histórico de mensagens');
        setLoading(false);
      }
    };

    loadHistory();
  }, [socket, user, type, gameId]);

  // Escutar novas mensagens
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = messageData => {
      // Verificar se a mensagem pertence a este chat
      if (type === 'game' && messageData.gameId !== gameId) return;
      if (type === 'general' && messageData.type !== 'general') return;

      setMessages(prev => [...prev, messageData]);
      scrollToBottom.current();
    };

    socket.on('chat:new_message', handleNewMessage);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
    };
  }, [socket, type, gameId]);

  // Scroll automático quando novas mensagens chegam
  useEffect(() => {
    scrollToBottom.current();
  }, [messages]);

  // Função para enviar mensagem
  const handleSendMessage = message => {
    if (!socket || !user?.id) {
      setError('Não foi possível enviar a mensagem');
      return;
    }

    socket.emit('chat:message', {
      type,
      message,
      gameId: type === 'game' ? gameId : undefined,
    });

    // Escutar erros
    const handleError = errorData => {
      setError(errorData.message || 'Erro ao enviar mensagem');
      setTimeout(() => setError(''), 5000);
    };

    socket.once('chat:error', handleError);
    socket.once('chat:message_sent', () => {
      // Mensagem enviada com sucesso
      socket.off('chat:error', handleError);
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center z-50"
        aria-label="Abrir chat"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border border-secondary-200 dark:border-secondary-700 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
        <h3 className="font-semibold text-secondary-900 dark:text-white">
          {type === 'game' ? 'Chat do Jogo' : 'Chat Geral'}
        </h3>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
            aria-label="Fechar chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={checkIfUserAtBottom}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader size="md" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">
              Nenhuma mensagem ainda. Seja o primeiro a enviar!
            </p>
          </div>
        ) : (
          <div className="py-2">
            {messages.map(msg => (
              <ChatMessage
                key={msg._id}
                nickname={msg.nickname}
                avatar={msg.avatar}
                message={msg.message}
                createdAt={msg.createdAt}
                isOwn={msg.userId === user?.id || msg.userId === user?._id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={loading || !socket?.connected}
        placeholder={type === 'game' ? 'Digite uma mensagem para o jogo...' : 'Digite uma mensagem...'}
      />
    </div>
  );
};

export default ChatBox;

