import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

/**
 * Toast Provider - Provê contexto de notificações toast
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  /**
   * Show a toast notification
   * @param {string} message - Toast message
   * @param {'success'|'error'|'warning'|'info'} type - Toast type
   * @param {number} duration - Duration in milliseconds
   */
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const toast = { id, message, type };

    setToasts(prev => [...prev, toast]);

    // Auto remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  /**
   * Remove a specific toast
   * @param {number} id - Toast ID
   */
  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = {
    toasts,
    showToast,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * Toast Container - Renders all active toasts
 */
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  const typeStyles = {
    success: 'bg-success-100 border-success-500 text-success-800 dark:bg-success-900 dark:text-success-200',
    error: 'bg-error-100 border-error-500 text-error-800 dark:bg-error-900 dark:text-error-200',
    warning: 'bg-warning-100 border-warning-500 text-warning-800 dark:bg-warning-900 dark:text-warning-200',
    info: 'bg-info-100 border-info-500 text-info-800 dark:bg-info-900 dark:text-info-200',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border-l-4 shadow-lg transition-all animate-slideInRight ${typeStyles[toast.type] || typeStyles.info}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Fechar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Hook to access toast context
 * @returns {Object} Toast context value
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export default ToastContext;
