/**
 * Avatar - Componente de avatar com suporte a imagem ou iniciais
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} [props.src] - URL da imagem do avatar
 * @param {string} [props.alt] - Texto alternativo da imagem
 * @param {string} [props.name] - Nome para gerar iniciais (fallback se sem imagem)
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'2xl'} [props.size='md'] - Tamanho do avatar
 * @param {string} [props.className=''] - Classes CSS adicionais
 *
 * @example
 * <Avatar src="/path/to/image.jpg" alt="John Doe" size="lg" />
 *
 * @example
 * <Avatar name="Jane Smith" size="md" />
 */
const Avatar = ({ src, alt, name, size = 'md', className = '', ...props }) => {
  const sizeStyles = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-20 h-20 text-2xl',
  };

  const getInitials = name => {
    if (!name) return '?';

    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const combinedClassName = `${sizeStyles[size]} rounded-full flex items-center justify-center overflow-hidden ${className}`;

  if (src) {
    return (
      <div className={combinedClassName} {...props}>
        <img src={src} alt={alt || name || 'Avatar'} className="w-full h-full object-cover" />
      </div>
    );
  }

  // Fallback to initials
  const initials = getInitials(name || alt);
  const colorClasses = [
    'bg-primary-500 text-white',
    'bg-accent-500 text-white',
    'bg-success-500 text-white',
    'bg-warning-500 text-white',
    'bg-error-500 text-white',
    'bg-secondary-500 text-white',
  ];

  // Simple hash function to get consistent color for same name
  const getColorClass = str => {
    if (!str) return colorClasses[0];
    const hash = str.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colorClasses[hash % colorClasses.length];
  };

  const colorClass = getColorClass(name || alt);

  return (
    <div className={`${combinedClassName} ${colorClass} font-semibold`} {...props}>
      {initials}
    </div>
  );
};

export default Avatar;
