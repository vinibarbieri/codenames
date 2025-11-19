import { useEffect } from 'react';
import Button from './Button';

/**
 * Modal - Componente de diálogo modal
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {boolean} props.isOpen - Controla se o modal está aberto
 * @param {function} props.onClose - Callback chamado ao fechar o modal
 * @param {string} [props.title] - Título do modal
 * @param {React.ReactNode} props.children - Conteúdo do modal
 * @param {React.ReactNode} [props.footer] - Conteúdo do footer (geralmente botões)
 * @param {'sm'|'md'|'lg'|'xl'|'full'} [props.size='md'] - Tamanho do modal
 * @param {boolean} [props.closeOnOverlayClick=true] - Permite fechar clicando fora
 * @param {boolean} [props.showCloseButton=true] - Exibe botão X de fechar
 *
 * @example
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirmar ação"
 *   footer={<Button onClick={handleConfirm}>Confirmar</Button>}
 * >
 *   <p>Tem certeza que deseja continuar?</p>
 * </Modal>
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  const handleOverlayClick = e => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={handleOverlayClick}
    >
      <div
        className={`relative w-full ${sizeStyles[size]} bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all animate-slideUp`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700">
            {title && (
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                aria-label="Fechar modal"
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
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 text-secondary-700 dark:text-secondary-300">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-secondary-200 dark:border-secondary-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
