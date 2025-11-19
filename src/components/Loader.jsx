/**
 * Loader - Componente de indicador de carregamento (spinner)
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md'] - Tamanho do spinner
 * @param {'primary'|'secondary'|'success'|'error'|'warning'|'white'} [props.color='primary'] - Cor do spinner
 * @param {string} [props.className=''] - Classes CSS adicionais
 *
 * @example
 * <Loader size="lg" color="primary" />
 *
 * @example
 * <Loader size="sm" color="white" className="ml-2" />
 */
const Loader = ({ size = 'md', color = 'primary', className = '' }) => {
  const sizeStyles = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colorStyles = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    success: 'text-success-600',
    error: 'text-error-600',
    warning: 'text-warning-600',
    white: 'text-white',
  };

  return (
      <div className={`inline-block ${className}`} role="status" aria-label="Carregando">
      <svg
        className={`animate-spin ${sizeStyles[size]} ${colorStyles[color]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span className="sr-only">Carregando...</span>
    </div>
  );
};

export default Loader;
