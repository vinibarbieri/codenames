import { forwardRef } from 'react';

/**
 * Input - Componente de campo de entrada com suporte a label, ícones e validação
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {string} [props.label] - Label do campo
 * @param {string} [props.error] - Mensagem de erro (exibe borda vermelha)
 * @param {string} [props.helperText] - Texto auxiliar abaixo do campo
 * @param {React.ReactNode} [props.leftIcon] - Ícone à esquerda
 * @param {React.ReactNode} [props.rightIcon] - Ícone à direita
 * @param {string} [props.className=''] - Classes CSS adicionais
 * @param {string} [props.type='text'] - Tipo do input HTML
 * @param {React.Ref} ref - Referência para o elemento DOM
 *
 * @example
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="seu@email.com"
 *   error="Email inválido"
 * />
 *
 * @example
 * <Input
 *   label="Buscar"
 *   leftIcon={<SearchIcon />}
 *   helperText="Digite para buscar"
 * />
 */
const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      type = 'text',
      className = '',
      containerClassName = '',
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    const baseStyles =
      'block w-full rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    const normalStyles =
      'border-secondary-300 dark:border-secondary-600 text-base dark:text-white placeholder-secondary-400 dark:placeholder-secondary-500 focus:border-primary-500 focus:ring-primary-500';

    const errorStyles =
      'border-error-500 text-error-900 dark:text-error-100 placeholder-error-300 dark:placeholder-error-400 focus:border-error-500 focus:ring-error-500';

    const inputStyles = `${baseStyles} ${hasError ? errorStyles : normalStyles} ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`;

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-secondary-400 dark:text-secondary-500">{leftIcon}</span>
            </div>
          )}

          <input ref={ref} type={type} className={inputStyles} {...props} />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-secondary-400 dark:text-secondary-500">{rightIcon}</span>
            </div>
          )}
        </div>

        {error && <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>}

        {helperText && !error && (
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
