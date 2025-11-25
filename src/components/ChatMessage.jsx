import Avatar from './Avatar.jsx';

/**
 * ChatMessage - Componente para exibir uma mensagem individual do chat
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} props.nickname - Nome do remetente
 * @param {string} [props.avatar] - URL do avatar do remetente
 * @param {string} props.message - Conteúdo da mensagem
 * @param {Date|string} props.createdAt - Data de criação da mensagem
 * @param {boolean} [props.isOwn=false] - Se a mensagem é do próprio usuário
 *
 * @example
 * <ChatMessage
 *   nickname="John Doe"
 *   avatar="/path/to/avatar.jpg"
 *   message="Hello, world!"
 *   createdAt={new Date()}
 *   isOwn={false}
 * />
 */
const ChatMessage = ({ nickname, avatar, message, createdAt, isOwn = false }) => {
  const formatTimestamp = date => {
    if (!date) return '';
    
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours} h atrás`;
    if (diffDays < 7) return `${diffDays} dias atrás`;
    
    return messageDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timestamp = formatTimestamp(createdAt);

  return (
    <div className={`flex gap-3 px-4 py-2 hover:bg-secondary-50 dark:hover:bg-gray-700/50 transition-colors ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar src={avatar} name={nickname} size="sm" />
      
      <div className={`flex-1 min-w-0 ${isOwn ? 'text-right' : ''}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm text-secondary-900 dark:text-white">
            {nickname}
          </span>
          <span className="text-xs text-secondary-500 dark:text-secondary-400">
            {timestamp}
          </span>
        </div>
        <p className="text-sm text-secondary-700 dark:text-secondary-300 break-words">
          {message}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;

