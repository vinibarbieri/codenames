/**
 * Card - Componente de cartão com opções de padding, sombra e hover
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {React.ReactNode} props.children - Conteúdo do cartão
 * @param {'none'|'sm'|'default'|'lg'|'xl'} [props.padding='default'] - Tamanho do padding interno
 * @param {'none'|'sm'|'default'|'lg'|'xl'} [props.shadow='default'] - Intensidade da sombra
 * @param {boolean} [props.hover=false] - Adiciona efeito hover (escala e sombra)
 * @param {string} [props.className=''] - Classes CSS adicionais
 *
 * @example
 * <Card padding="lg" shadow="lg" hover>
 *   <h3>Título do Card</h3>
 *   <p>Conteúdo do card</p>
 * </Card>
 */
const Card = ({
  children,
  className = '',
  hover = false,
  padding = 'default',
  shadow = 'default',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-2',
    default: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  const shadowStyles = {
    none: 'shadow-none',
    sm: 'shadow-sm',
    default: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };

  const hoverStyles = hover
    ? 'hover:shadow-lg hover:scale-[1.02] transition-all duration-200'
    : '';

  const combinedClassName = `rounded-lg bg-white dark:bg-gray-800 text-secondary-900 dark:text-white ${paddingStyles[padding]} ${shadowStyles[shadow]} ${hoverStyles} ${className}`;

  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
};

export default Card;
