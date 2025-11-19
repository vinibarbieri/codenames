import { useState } from 'react';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import Loader from '../components/Loader';
import Toast from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';

/**
 * ComponentShowcase - Página de demonstração de todos os componentes da UI
 *
 * Esta página apresenta todos os componentes disponíveis com suas variações,
 * tamanhos e estados, permitindo visualizar o design system completo.
 */
const ComponentShowcase = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = id => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="bg-surface border-b border-secondary-200 dark:border-secondary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-base">Vitrine de Componentes</h1>
              <p className="text-sm sm:text-base text-muted mt-1 sm:mt-2">
                Sistema de design e biblioteca de componentes
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Typography Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Tipografia</h2>
          <Card>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h1 className="text-4xl font-bold text-base">Heading 1 - 4xl</h1>
                <code className="text-xs sm:text-sm text-muted">text-4xl font-bold</code>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-base">Heading 2 - 3xl</h2>
                <code className="text-xs sm:text-sm text-muted">text-3xl font-bold</code>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-base">Heading 3 - 2xl</h3>
                <code className="text-xs sm:text-sm text-muted">text-2xl font-bold</code>
              </div>
              <div>
                <p className="text-base text-base">Body Text - Base (16px)</p>
                <code className="text-xs sm:text-sm text-muted">text-base</code>
              </div>
              <div>
                <p className="text-sm text-base">Small Text - SM (14px)</p>
                <code className="text-xs sm:text-sm text-muted">text-sm</code>
              </div>
            </div>
          </Card>
        </section>

        {/* Buttons Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Botões</h2>

          {/* Variants */}
          <Card className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Variantes</h3>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button variant="primary">Primário</Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="danger">Perigo</Button>
              <Button variant="success">Sucesso</Button>
              <Button variant="warning">Aviso</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="outline">Contorno</Button>
            </div>
          </Card>

          {/* Sizes */}
          <Card className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Tamanhos</h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <Button size="xl">Extra Grande</Button>
            </div>
          </Card>

          {/* States */}
          <Card>
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Estados</h3>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button>Normal</Button>
              <Button disabled>Desabilitado</Button>
              <Button loading>Carregando</Button>
            </div>
          </Card>
        </section>

        {/* Inputs Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Campos de Entrada</h2>

          <Card className="space-y-4 sm:space-y-6">
            <Input
              label="Input Básico"
              placeholder="Digite algo..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
            />

            <Input
              label="Input com Helper Text"
              placeholder="exemplo@email.com"
              helperText="Digite um email válido"
            />

            <Input
              label="Input com Erro"
              placeholder="Digite algo..."
              error="Este campo é obrigatório"
            />

            <Input
              label="Input Desabilitado"
              placeholder="Desabilitado"
              disabled
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Input com Ícone (esquerda)"
                placeholder="Buscar..."
                leftIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />

              <Input
                label="Input com Ícone (direita)"
                placeholder="Senha"
                type="password"
                rightIcon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              />
            </div>
          </Card>
        </section>

        {/* Cards Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Cards</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card padding="sm" shadow="sm">
              <h3 className="text-base sm:text-lg font-semibold text-base mb-2">Padding e Sombra Pequenos</h3>
              <p className="text-sm text-muted">Padding: sm, Sombra: sm</p>
            </Card>

            <Card padding="default" shadow="default">
              <h3 className="text-base sm:text-lg font-semibold text-base mb-2">Padding e Sombra Padrão</h3>
              <p className="text-sm text-muted">Padding: padrão, Sombra: padrão</p>
            </Card>

            <Card padding="lg" shadow="lg" hover>
              <h3 className="text-base sm:text-lg font-semibold text-base mb-2">Padding e Sombra Grandes (Hover)</h3>
              <p className="text-sm text-muted">Padding: lg, Sombra: lg, Hover: verdadeiro</p>
            </Card>
          </div>
        </section>

        {/* Avatars Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Avatares</h2>

          <Card>
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Tamanhos</h3>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="text-center">
                <Avatar name="John Doe" size="xs" />
                <p className="text-xs text-muted mt-1">xs</p>
              </div>
              <div className="text-center">
                <Avatar name="Jane Smith" size="sm" />
                <p className="text-xs text-muted mt-1">sm</p>
              </div>
              <div className="text-center">
                <Avatar name="Bob Johnson" size="md" />
                <p className="text-xs text-muted mt-1">md</p>
              </div>
              <div className="text-center">
                <Avatar name="Alice Brown" size="lg" />
                <p className="text-xs text-muted mt-1">lg</p>
              </div>
              <div className="text-center">
                <Avatar name="Charlie Wilson" size="xl" />
                <p className="text-xs text-muted mt-1">xl</p>
              </div>
              <div className="text-center">
                <Avatar name="Diana Davis" size="2xl" />
                <p className="text-xs text-muted mt-1">2xl</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Loaders Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Carregadores</h2>

          <Card className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Tamanhos</h3>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="text-center">
                <Loader size="xs" />
                <p className="text-xs text-muted mt-1">xs</p>
              </div>
              <div className="text-center">
                <Loader size="sm" />
                <p className="text-xs text-muted mt-1">sm</p>
              </div>
              <div className="text-center">
                <Loader size="md" />
                <p className="text-xs text-muted mt-1">md</p>
              </div>
              <div className="text-center">
                <Loader size="lg" />
                <p className="text-xs text-muted mt-1">lg</p>
              </div>
              <div className="text-center">
                <Loader size="xl" />
                <p className="text-xs text-muted mt-1">xl</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg sm:text-xl font-semibold text-base mb-3 sm:mb-4">Cores</h3>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <div className="text-center">
                <Loader color="primary" />
                <p className="text-xs text-muted mt-1">primary</p>
              </div>
              <div className="text-center">
                <Loader color="secondary" />
                <p className="text-xs text-muted mt-1">secondary</p>
              </div>
              <div className="text-center">
                <Loader color="success" />
                <p className="text-xs text-muted mt-1">success</p>
              </div>
              <div className="text-center">
                <Loader color="error" />
                <p className="text-xs text-muted mt-1">error</p>
              </div>
              <div className="text-center">
                <Loader color="warning" />
                <p className="text-xs text-muted mt-1">warning</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Modal Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Modal</h2>

          <Card>
            <Button onClick={() => setModalOpen(true)}>Abrir Modal</Button>

            <Modal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Exemplo de Modal"
              size="md"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
                </>
              }
            >
              <p className="text-base text-base">
                Este é um exemplo de modal com título, conteúdo e footer com botões.
                O modal pode ser fechado clicando fora dele, no X ou pressionando ESC.
              </p>
            </Modal>
          </Card>
        </section>

        {/* Toast Section */}
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-base mb-4 sm:mb-6">Notificações</h2>

          <Card>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button variant="success" onClick={() => addToast('Operação realizada com sucesso!', 'success')}>
                Notificação Sucesso
              </Button>
              <Button variant="danger" onClick={() => addToast('Ocorreu um erro!', 'error')}>
                Notificação Erro
              </Button>
              <Button variant="warning" onClick={() => addToast('Atenção: Verifique os dados', 'warning')}>
                Notificação Aviso
              </Button>
              <Button onClick={() => addToast('Informação importante', 'info')}>
                Notificação Info
              </Button>
            </div>
          </Card>
        </section>
      </main>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={removeToast}
          />
        ))}
      </div>
    </div>
  );
};

export default ComponentShowcase;
