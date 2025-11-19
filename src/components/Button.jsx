import { forwardRef } from 'react';

/**
 * Button - Componente de botão com múltiplas variantes e estados
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {React.ReactNode} props.children - Conteúdo do botão
 * @param {'primary'|'secondary'|'danger'|'success'|'warning'|'ghost'|'outline'} [props.variant='primary'] - Variante visual do botão
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] - Tamanho do botão
 * @param {boolean} [props.loading=false] - Estado de carregamento (exibe spinner)
 * @param {boolean} [props.disabled=false] - Estado desabilitado
 * @param {string} [props.className=''] - Classes CSS adicionais
 * @param {'button'|'submit'|'reset'} [props.type='button'] - Tipo HTML do botão
 * @param {React.Ref} ref - Referência para o elemento DOM
 *
 * @example
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Clique aqui
 * </Button>
 *
 * @example
 * <Button variant="danger" loading disabled>
 *   Carregando...
 * </Button>
 */
const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary:
        'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600',
      secondary:
        'bg-secondary-200 text-secondary-800 hover:bg-secondary-300 focus:ring-secondary-500 dark:bg-secondary-700 dark:text-secondary-100 dark:hover:bg-secondary-600',
      danger:
        'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500 dark:bg-error-500 dark:hover:bg-error-600',
      success:
        'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500 dark:bg-success-500 dark:hover:bg-success-600',
      warning:
        'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 dark:bg-warning-500 dark:hover:bg-warning-600',
      ghost:
        'bg-transparent hover:bg-secondary-100 text-secondary-700 dark:hover:bg-secondary-800 dark:text-secondary-300 focus:ring-secondary-500',
      outline:
        'bg-transparent border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-400 dark:hover:bg-primary-900/20 focus:ring-primary-500',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
      xl: 'px-8 py-4 text-xl',
    };

    const combinedClassName = `${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${sizeStyles[size] || sizeStyles.md} ${className}`;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={combinedClassName}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
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
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
