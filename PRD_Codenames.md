# PRD - Implementação do Jogo Codenames

## 1. Visão Geral do Produto

### 1.1 Objetivo
Desenvolver um MVP funcional do jogo Codenames como aplicação web, permitindo partidas entre jogadores humanos e bots, com sistema de pontuação, gravação de partidas e chat integrado.

### 1.2 Escopo
Aplicação web multiplayer do jogo Codenames com autenticação de usuários, sistema de filas, chat, videochat, gravação de partidas e painel administrativo.

### 1.3 Stack Tecnológica
- **Frontend**: React + Vite + Tailwind CSS + JavaScript
- **Backend**: Node.js + Express.js
- **Banco de Dados**: MongoDB
- **Comunicação Real-time**: Socket.io
- **Gravação de Vídeo**: FFMPEG
- **Videochat**: WebRTC (SimpleWebRTC ou PeerJS)
- **Autenticação**: JWT (JSON Web Tokens)
- **Deploy**: VPS-UFSC com HTTPS (Let's Encrypt)

---

## 2. Arquitetura do Sistema

### 2.1 Padrão de Projeto
**MVC (Model-View-Controller)**

```
/codenames-app
├── /client (Frontend - React)
│   ├── /src
│   │   ├── /components (View)
│   │   ├── /pages (View)
│   │   ├── /controllers (Controller - lógica de UI)
│   │   ├── /services (Comunicação com API)
│   │   ├── /hooks (React Hooks customizados)
│   │   ├── /utils (Funções auxiliares)
│   │   └── /assets (Imagens, ícones)
│   └── /public
├── /server (Backend - Node.js)
│   ├── /models (Model - Mongoose Schemas)
│   ├── /controllers (Controller - lógica de negócio)
│   ├── /routes (Rotas da API)
│   ├── /middleware (Autenticação, validação)
│   ├── /services (Serviços - Socket.io, FFMPEG)
│   └── /utils (Funções auxiliares)
└── /shared (Código compartilhado)
```

### 2.2 Fluxo de Dados
1. **Cliente** → Requisição HTTP/WebSocket → **Rotas**
2. **Rotas** → **Middleware** (autenticação, validação)
3. **Middleware** → **Controllers** (lógica de negócio)
4. **Controllers** → **Models** (operações no BD)
5. **Models** → **MongoDB**
6. **Controllers** → Resposta → **Cliente**

---

## 3. Funcionalidades por Módulo

### 3.1 Módulo de Autenticação

#### 3.1.1 Cadastro de Usuário
**Campos obrigatórios:**
- Nome (nickname) - único
- Idade
- Cidade, Estado, País
- Senha (hash com bcrypt)
- Avatar (URL, upload ou webcam)

**Validações:**
- Nickname único
- Senha mínima: 6 caracteres
- Idade mínima: 13 anos

**Endpoints:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/verify` (validar token JWT)

#### 3.1.2 Login
- Autenticação via JWT
- Token expira em 7 dias
- Refresh token implementado

#### 3.1.3 Perfil do Usuário
- `GET /api/users/:id` - Buscar perfil
- `PUT /api/users/:id` - Atualizar dados
- `GET /api/users/:id/stats` - Estatísticas (partidas, pontuação)

---

### 3.2 Módulo do Jogo

#### 3.2.1 Regras do Codenames (Simplificadas para MVP)
- **Tabuleiro**: 5x5 palavras (25 cartas)
- **Equipes**: 2 jogadores (Espião Mestre vs Espião Mestre)
- **Cores das cartas**:
  - 9 cartas da equipe vermelha
  - 8 cartas da equipe azul
  - 7 cartas neutras (inocentes)
  - 1 carta assassino (perde imediatamente)
- **Objetivo**: Descobrir todas as palavras da sua equipe antes do oponente
- **Turnos**: Alternados entre jogadores
- **Dica**: Espião Mestre dá uma palavra + número (quantas cartas relacionadas)

#### 3.2.2 Modos de Jogo
1. **Humano vs Humano** (prioridade MVP)
2. **Humano vs Bot** (implementação simplificada)

**Bot (lógica básica):**
- Escolhe palavras aleatórias da sua equipe
- Dá dicas genéricas (ex: "objetos", "animais")

#### 3.2.3 Sistema de Filas
- Fila máxima: 25 jogadores (configurável)
- Timeout de inatividade: 60 segundos (configurável)
- Matchmaking: FIFO (primeiro a entrar, primeiro a jogar)

**Endpoints:**
- `POST /api/queue/join` - Entrar na fila
- `DELETE /api/queue/leave` - Sair da fila
- `GET /api/queue/status` - Status da fila

#### 3.2.4 Partida
**Estados da partida:**
- `waiting` - Aguardando jogadores
- `in_progress` - Em andamento
- `finished` - Finalizada

**Eventos Socket.io:**
- `game:start` - Início da partida
- `game:clue` - Espião Mestre dá dica
- `game:guess` - Jogador escolhe carta
- `game:turn` - Mudança de turno
- `game:end` - Fim da partida

**Endpoints:**
- `POST /api/games/create` - Criar partida
- `GET /api/games/:id` - Buscar partida
- `POST /api/games/:id/clue` - Enviar dica
- `POST /api/games/:id/guess` - Escolher carta
- `PUT /api/games/:id/end` - Finalizar partida

---

### 3.3 Módulo de Chat

#### 3.3.1 Chat Escrito
**Tipos:**
- **Partida**: Apenas jogadores ativos
- **Geral**: Todos os jogadores (fila + partida)

**Eventos Socket.io:**
- `chat:message` - Enviar mensagem
- `chat:history` - Histórico de mensagens

**Segurança:**
- Sanitização de HTML (prevenção XSS)
- Rate limiting: 10 mensagens/minuto

#### 3.3.2 Videochat (WebRTC)
- Apenas para jogadores em partida
- Peer-to-peer com PeerJS
- Controles: mute áudio, desligar vídeo
- Fallback: áudio apenas se câmera indisponível

---

### 3.4 Módulo de Gravação

#### 3.4.1 Gravação de Partidas (FFMPEG)
**Configurações padrão:**
- **Vídeo**: WebM, 4 Mbit/s, 24 FPS
- **Áudio**: 128 kbit/s, stereo, 44100 Hz
- **Área de gravação**: Tabuleiro + pontuação + nomes (não inclui chat/vídeo por padrão)

**Opções configuráveis:**
- Full screen (incluir chat e videochat)
- Apenas tabuleiro (padrão)

**Armazenamento:**
- MongoDB GridFS (arquivos grandes)
- Tempo máximo: 15 dias (configurável)
- Limite de storage: 1 GB por usuário (configurável)

**Endpoints:**
- `POST /api/recordings/start` - Iniciar gravação
- `POST /api/recordings/stop` - Parar gravação
- `GET /api/recordings/:id` - Buscar vídeo
- `GET /api/recordings/:id/stream` - Stream do vídeo

#### 3.4.2 Player de Vídeo
- Player HTML5 simples com controles nativos
- URL compartilhável: `https://app.com/watch/:recordingId`
- Informações exibidas: jogadores, data/hora, pontuação final

---

### 3.5 Módulo de Pontuação e Ranking

#### 3.5.1 Sistema de Pontos
- **Vitória**: +10 pontos
- **Derrota**: +3 pontos (participação)
- **Vitória rápida** (< 10 turnos): +5 pontos bônus

#### 3.5.2 Ranking
- Top 100 jogadores
- Ordenação: pontuação total
- Filtros: global, por país, por estado

**Endpoints:**
- `GET /api/ranking` - Ranking global
- `GET /api/ranking/country/:country` - Por país
- `GET /api/ranking/user/:id` - Posição do usuário

#### 3.5.3 Histórico de Partidas
**Dados armazenados:**
- ID da partida
- Data/hora
- Oponente
- Resultado (vitória/derrota)
- Pontuação
- Link do vídeo (se gravado)
- Duração da partida

**Endpoints:**
- `GET /api/users/:id/matches` - Histórico de partidas

---

### 3.6 Módulo Administrativo

#### 3.6.1 Painel Admin
**Funcionalidades:**
- CRUD de usuários
- CRUD de avatares padrão
- Gerenciamento de jogadores online
- Configurações do sistema
- Limpeza de vídeos antigos (> 15 dias)
- Estatísticas do servidor

**Endpoints (requer role admin):**
- `GET /api/admin/users` - Listar usuários
- `DELETE /api/admin/users/:id` - Deletar usuário
- `PUT /api/admin/config` - Atualizar configurações
- `GET /api/admin/stats` - Estatísticas
- `POST /api/admin/avatars` - Upload avatar padrão
- `DELETE /api/admin/recordings/cleanup` - Limpar vídeos antigos

#### 3.6.2 Configurações Gerenciáveis
```javascript
{
  queueMaxSize: 25,
  inactivityTimeout: 60, // segundos
  maxVideoStorageDays: 15,
  maxVideoStoragePerUser: 1073741824, // 1 GB em bytes
  recordingDefaults: {
    videoBitrate: '4M',
    fps: 24,
    audioBitrate: '128k',
    audioChannels: 2,
    sampleRate: 44100
  }
}
```

---

## 4. Modelos de Dados (MongoDB)

### 4.1 User
```javascript
{
  _id: ObjectId,
  nickname: String (unique, required),
  email: String (unique, required),
  password: String (hashed, required),
  age: Number (required),
  location: {
    city: String (required),
    state: String (required),
    country: String (required)
  },
  avatar: String (URL),
  score: Number (default: 0),
  role: String (enum: ['user', 'admin'], default: 'user'),
  isOnline: Boolean (default: false),
  lastActive: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 Game
```javascript
{
  _id: ObjectId,
  players: [
    {
      userId: ObjectId (ref: 'User'),
      team: String (enum: ['red', 'blue']),
      role: String (enum: ['spymaster', 'operative'])
    }
  ],
  board: [
    {
      word: String,
      type: String (enum: ['red', 'blue', 'neutral', 'assassin']),
      revealed: Boolean (default: false)
    }
  ],
  currentTurn: String (enum: ['red', 'blue']),
  currentClue: {
    word: String,
    number: Number,
    remainingGuesses: Number
  },
  status: String (enum: ['waiting', 'in_progress', 'finished']),
  winner: String (enum: ['red', 'blue', null]),
  mode: String (enum: ['human_vs_human', 'human_vs_bot']),
  turnCount: Number (default: 0),
  recordingId: ObjectId (ref: 'Recording', nullable),
  startedAt: Date,
  finishedAt: Date,
  createdAt: Date
}
```

### 4.3 Recording
```javascript
{
  _id: ObjectId,
  gameId: ObjectId (ref: 'Game', required),
  userId: ObjectId (ref: 'User', required),
  fileId: ObjectId (GridFS file ID),
  filename: String,
  duration: Number (seconds),
  size: Number (bytes),
  format: String (default: 'webm'),
  settings: {
    videoBitrate: String,
    fps: Number,
    audioBitrate: String,
    fullScreen: Boolean
  },
  shareUrl: String,
  views: Number (default: 0),
  createdAt: Date,
  expiresAt: Date
}
```

### 4.4 ChatMessage
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  gameId: ObjectId (ref: 'Game', nullable),
  type: String (enum: ['game', 'general']),
  message: String (required, max: 500),
  createdAt: Date
}
```

### 4.5 Queue
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  joinedAt: Date (required),
  lastPing: Date (required)
}
```

### 4.6 Config
```javascript
{
  _id: ObjectId,
  key: String (unique, required),
  value: Mixed (required),
  updatedAt: Date
}
```

---

## 5. Interface do Usuário

### 5.1 Páginas Principais

#### 5.1.1 Landing Page (`/`)
- Logo do jogo
- Botão "Jogar Agora"
- Botão "Login" / "Cadastrar"
- Ranking Top 10
- Tutorial rápido (modal)

#### 5.1.2 Login/Cadastro (`/login`, `/register`)
- Formulário responsivo
- Validação em tempo real
- Upload de avatar (opcional)
- Opção "Lembrar-me"

#### 5.1.3 Lobby (`/lobby`)
**Componentes:**
- Perfil do usuário (avatar, nome, pontuação)
- Botão "Entrar na Fila"
- Status da fila (posição, tempo estimado)
- Botão "Jogar com Bot"
- Lista de partidas recentes
- Ranking lateral (top 10)
- Chat geral

#### 5.1.4 Game (`/game/:id`)
**Layout:**
```
┌─────────────────────────────────────────┐
│ Header: Player1 vs Player2 | Score     │
├──────────────┬──────────────────────────┤
│              │                          │
│  Videochat   │      Tabuleiro 5x5      │
│  (opcional)  │                          │
│              │                          │
├──────────────┤                          │
│    Chat      │                          │
│   (toggle)   │                          │
└──────────────┴──────────────────────────┘
```

**Componentes:**
- Tabuleiro 5x5 com cartas
- Indicador de turno
- Área de dica (palavra + número)
- Timer de inatividade
- Botão "Desistir"
- Chat toggle
- Videochat toggle
- Controles de áudio/vídeo
- Botão "Gravar Partida"

#### 5.1.5 Perfil (`/profile/:id`)
- Avatar grande
- Estatísticas (vitórias, derrotas, pontuação)
- Histórico de partidas (tabela paginada)
- Vídeos gravados (grid)
- Botão "Editar Perfil" (se for o próprio usuário)

#### 5.1.6 Ranking (`/ranking`)
- Tabela com top 100
- Filtros (global, país, estado)
- Buscar jogador
- Highlight do usuário logado

#### 5.1.7 Watch (`/watch/:recordingId`)
- Player de vídeo HTML5
- Informações da partida
- Botão "Compartilhar"
- Comentários (opcional para v2)

#### 5.1.8 Admin (`/admin`)
**Seções:**
- Dashboard (estatísticas)
- Gerenciar Usuários (tabela com CRUD)
- Gerenciar Avatares
- Configurações do Sistema
- Limpeza de Vídeos
- Logs do Servidor

### 5.2 Componentes Reutilizáveis

#### 5.2.1 Componentes de UI
- `<Button>` - Botão customizado
- `<Input>` - Campo de entrada
- `<Card>` - Card genérico
- `<Modal>` - Modal genérico
- `<Avatar>` - Avatar do usuário
- `<Loader>` - Loading spinner
- `<Toast>` - Notificações

#### 5.2.2 Componentes do Jogo
- `<GameBoard>` - Tabuleiro 5x5
- `<GameCard>` - Carta individual
- `<ClueInput>` - Input para dica
- `<TurnIndicator>` - Indicador de turno
- `<ScoreBoard>` - Placar

#### 5.2.3 Componentes de Chat
- `<ChatBox>` - Container do chat
- `<ChatMessage>` - Mensagem individual
- `<ChatInput>` - Input de mensagem

#### 5.2.4 Componentes de Vídeo
- `<VideoChat>` - WebRTC videochat
- `<VideoPlayer>` - Player de vídeo
- `<RecordingControls>` - Controles de gravação

### 5.3 Tema e Design System

#### 5.3.1 Cores (Tailwind)
**Light Mode:**
```javascript
{
  primary: 'blue-600',
  secondary: 'gray-600',
  accent: 'purple-500',
  success: 'green-500',
  error: 'red-500',
  warning: 'yellow-500',
  background: 'white',
  surface: 'gray-100',
  text: 'gray-900'
}
```

**Dark Mode:**
```javascript
{
  primary: 'blue-400',
  secondary: 'gray-400',
  accent: 'purple-400',
  success: 'green-400',
  error: 'red-400',
  warning: 'yellow-400',
  background: 'gray-900',
  surface: 'gray-800',
  text: 'gray-100'
}
```

#### 5.3.2 Tipografia
- **Headings**: font-bold, text-2xl a text-4xl
- **Body**: font-normal, text-base
- **Small**: text-sm

#### 5.3.3 Responsividade
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md)
- **Desktop**: > 1024px (lg)

**Breakpoints Tailwind:**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

---

## 6. Segurança

### 6.1 Proteções Implementadas

#### 6.1.1 XSS (Cross-Site Scripting)
- Sanitização de inputs com `DOMPurify`
- React automaticamente escapa JSX
- Content Security Policy (CSP) headers
- Validação de HTML no chat

#### 6.1.2 CSRF (Cross-Site Request Forgery)
- Tokens CSRF em formulários
- SameSite cookies
- Validação de origem (Origin/Referer headers)

#### 6.1.3 Injeção SQL/NoSQL
- Mongoose sanitização automática
- Validação de schemas com Joi
- Prepared statements (queries parametrizadas)

#### 6.1.4 Exposição de Dados Sensíveis
- Senhas hasheadas com bcrypt (salt rounds: 10)
- JWT com expiração
- HTTPS obrigatório
- Variáveis de ambiente para secrets (.env)
- Não expor stack traces em produção

#### 6.1.5 Autenticação e Autorização
- JWT com refresh tokens
- Role-based access control (RBAC)
- Rate limiting (express-rate-limit):
  - Login: 5 tentativas / 15 min
  - API: 100 requisições / 15 min
  - Chat: 10 mensagens / min

#### 6.1.6 Validação de Dados
- Joi schemas em todas as rotas
- Validação client-side (React Hook Form)
- Validação server-side (middleware)

#### 6.1.7 Headers de Segurança (Helmet.js)
```javascript
{
  contentSecurityPolicy: true,
  hsts: true,
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
}
```

### 6.2 Boas Práticas
- Logs de auditoria (Winston)
- Monitoramento de erros (Sentry - opcional)
- Backups diários do MongoDB
- Dependências atualizadas (npm audit)
- Testes de segurança (OWASP ZAP - opcional)

---

## 7. Fluxos de Usuário

### 7.1 Fluxo de Cadastro e Login
```
1. Usuário acessa /register
2. Preenche formulário (nome, email, senha, idade, localização)
3. (Opcional) Upload de avatar
4. Submit → POST /api/auth/register
5. Backend valida dados
6. Backend cria usuário no MongoDB
7. Backend retorna JWT token
8. Frontend armazena token (localStorage)
9. Redirect para /lobby
```

### 7.2 Fluxo de Matchmaking
```
1. Usuário clica "Entrar na Fila" no /lobby
2. Frontend → POST /api/queue/join
3. Backend adiciona usuário na fila
4. Backend emite evento Socket.io → 'queue:update'
5. Frontend atualiza posição na fila em tempo real
6. Quando 2 jogadores disponíveis:
   a. Backend cria partida → POST /api/games/create
   b. Backend remove jogadores da fila
   c. Backend emite 'game:start' para ambos
7. Frontend redireciona para /game/:id
```

### 7.3 Fluxo de Partida
```
1. Jogadores conectam via Socket.io
2. Backend sorteia tabuleiro (25 palavras aleatórias)
3. Backend define cores das cartas (9 red, 8 blue, 7 neutral, 1 assassin)
4. Backend envia estado inicial → 'game:state'
5. Turno do Spymaster vermelho:
   a. Dá dica (palavra + número) → POST /api/games/:id/clue
   b. Backend valida e emite → 'game:clue'
6. Operative vermelho escolhe cartas:
   a. Clica em carta → POST /api/games/:id/guess
   b. Backend revela carta e emite → 'game:reveal'
   c. Se acertou: continua (até acabar tentativas ou errar)
   d. Se errou/neutro: passa turno → 'game:turn'
   e. Se assassino: perde imediatamente → 'game:end'
7. Repete até uma equipe descobrir todas as suas cartas
8. Backend calcula pontuação
9. Backend salva partida no MongoDB
10. Frontend exibe modal de vitória/derrota
11. Redirect para /lobby
```

### 7.4 Fluxo de Gravação
```
1. Jogador clica "Gravar Partida"
2. Frontend → POST /api/recordings/start
3. Backend inicia FFMPEG:
   a. Captura canvas do tabuleiro
   b. Captura áudio (se habilitado)
4. Durante a partida: FFMPEG grava em buffer
5. Partida termina → POST /api/recordings/stop
6. Backend finaliza arquivo WebM
7. Backend salva em MongoDB GridFS
8. Backend retorna recordingId
9. Frontend exibe link: /watch/:recordingId
```

### 7.5 Fluxo de Compartilhamento
```
1. Usuário acessa /profile/:id
2. Clica em vídeo gravado
3. Modal abre com botão "Compartilhar"
4. Copia URL: https://app.com/watch/:recordingId
5. Qualquer pessoa (logada ou não) acessa URL
6. Frontend → GET /api/recordings/:recordingId
7. Backend retorna metadados + stream URL
8. Player HTML5 carrega vídeo via GridFS stream
```

---

## 8. Critérios de Aceitação (MVP)

### 8.1 Funcionalidades Essenciais (Must Have)
- [ ] Cadastro e login de usuários
- [ ] Autenticação JWT funcionando
- [ ] Sistema de filas (matchmaking)
- [ ] Partida Humano vs Humano funcional
- [ ] Regras básicas do Codenames implementadas
- [ ] Chat escrito (partida + geral)
- [ ] Pontuação e ranking
- [ ] Histórico de partidas
- [ ] Responsividade (mobile + desktop)
- [ ] Light/Dark mode
- [ ] Painel admin básico (CRUD usuários)
- [ ] HTTPS configurado
- [ ] MongoDB funcionando

### 8.2 Funcionalidades Importantes (Should Have)
- [ ] Gravação de partidas (FFMPEG)
- [ ] Player de vídeo
- [ ] Compartilhamento de vídeos
- [ ] Videochat (WebRTC)
- [ ] Modo vs Bot
- [ ] Upload de avatar customizado
- [ ] Limpeza automática de vídeos antigos
- [ ] Timeout de inatividade

### 8.3 Funcionalidades Desejáveis (Nice to Have)
- [ ] Webcam como avatar (ao vivo)
- [ ] Efeitos sonoros
- [ ] Animações no tabuleiro
- [ ] Tutorial interativo
- [ ] Filtros avançados de ranking
- [ ] Estatísticas detalhadas
- [ ] Notificações push
- [ ] Internacionalização (i18n)

---

## 9. Roadmap de Desenvolvimento

### Fase 1: Setup e Infraestrutura (Semana 1)
- [ ] Configurar Vite + React + Tailwind
- [ ] Configurar Node.js + Express + MongoDB
- [ ] Setup Docker (opcional, para desenvolvimento)
- [ ] Configurar ESLint + Prettier
- [ ] Estrutura de pastas (MVC)
- [ ] Configurar variáveis de ambiente
- [ ] Setup Git + repositório

### Fase 2: Autenticação (Semana 2)
- [ ] Modelo User (Mongoose)
- [ ] Rotas de auth (register, login, verify)
- [ ] Middleware de autenticação JWT
- [ ] Páginas de Login/Cadastro (React)
- [ ] Context API para auth
- [ ] Proteção de rotas (frontend)

### Fase 3: Interface Base (Semana 3)
- [ ] Layout principal (Navbar, Footer)
- [ ] Landing page
- [ ] Lobby page
- [ ] Perfil page
- [ ] Tema Light/Dark
- [ ] Componentes reutilizáveis (Button, Input, Card)
- [ ] Responsividade básica

### Fase 4: Sistema de Jogo (Semanas 4-5)
- [ ] Modelo Game (Mongoose)
- [ ] Lógica do Codenames (backend)
- [ ] Sistema de filas (Modelo Queue)
- [ ] Socket.io setup
- [ ] Componente GameBoard
- [ ] Componente GameCard
- [ ] Fluxo de partida completo
- [ ] Pontuação e ranking

### Fase 5: Chat (Semana 6)
- [ ] Modelo ChatMessage
- [ ] Socket.io events para chat
- [ ] Componente ChatBox
- [ ] Chat geral e por partida
- [ ] Sanitização de mensagens

### Fase 6: Gravação e Vídeo (Semana 7)
- [ ] Modelo Recording
- [ ] Setup FFMPEG (backend)
- [ ] GridFS para armazenamento
- [ ] Endpoint de start/stop recording
- [ ] Player de vídeo (frontend)
- [ ] Página /watch/:id
- [ ] Compartilhamento de URL

### Fase 7: Videochat (Semana 8)
- [ ] Setup WebRTC (PeerJS ou SimpleWebRTC)
- [ ] Componente VideoChat
- [ ] Controles de áudio/vídeo
- [ ] Integração com partida

### Fase 8: Admin e Configurações (Semana 9)
- [ ] Painel admin (React)
- [ ] CRUD de usuários
- [ ] Modelo Config
- [ ] Gerenciamento de configurações
- [ ] Limpeza automática de vídeos

### Fase 9: Modo Bot (Semana 10)
- [ ] Lógica básica de IA
- [ ] Integração com fluxo de jogo
- [ ] Testes de bot

### Fase 10: Testes e Deploy (Semanas 11-12)
- [ ] Testes unitários (Jest)
- [ ] Testes de integração
- [ ] Testes de segurança (OWASP)
- [ ] Deploy no VPS-UFSC
- [ ] Configurar HTTPS (Let's Encrypt)
- [ ] Configurar PM2 ou similar
- [ ] Monitoramento (logs, uptime)
- [ ] Documentação (README, API docs)

---

## 10. Especificações Técnicas

### 10.1 Performance
- **Tempo de carregamento inicial**: < 3 segundos
- **Latência de Socket.io**: < 100ms
- **FPS do jogo**: 60 FPS
- **Suporte**: 100 usuários simultâneos (MVP)

### 10.2 Compatibilidade
- **Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS 14+, Android 10+
- **Screen sizes**: 320px - 2560px

### 10.3 Disponibilidade
- **Uptime**: 99% (24/7)
- **Backups**: Diários (MongoDB)
- **Disaster recovery**: Restauração < 4 horas

### 10.4 Escalabilidade (pós-MVP)
- Migrar para cluster Node.js
- Redis para sessões e cache
- CDN para assets estáticos
- Load balancer (Nginx)
- Kubernetes (opcional)

---

## 11. Dependências Principais

### 11.1 Frontend
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "socket.io-client": "^4.5.0",
    "axios": "^1.6.0",
    "peerjs": "^1.5.0",
    "dompurify": "^3.0.0",
    "react-hook-form": "^7.48.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

### 11.2 Backend
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^8.0.0",
    "socket.io": "^4.5.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "joi": "^17.11.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "express-rate-limit": "^7.1.0",
    "fluent-ffmpeg": "^2.1.2",
    "multer": "^1.4.5-lts.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0"
  }
}
```

---

## 12. Métricas de Sucesso

### 12.1 KPIs Técnicos
- **Uptime**: > 99%
- **Tempo de resposta API**: < 200ms (p95)
- **Bugs críticos**: 0
- **Cobertura de testes**: > 70%

### 12.2 KPIs de Produto
- **Usuários cadastrados**: 100+ (1º mês)
- **Partidas diárias**: 50+ (1º mês)
- **Taxa de retenção**: > 40% (D7)
- **Tempo médio de sessão**: > 15 min

### 12.3 KPIs de Negócio (pós-MVP)
- **Taxa de conversão**: > 5% (visitantes → cadastrados)
- **NPS**: > 50
- **Custo por usuário**: < R$ 2,00/mês

---

## 13. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Complexidade do WebRTC | Alta | Alto | Usar bibliotecas maduras (PeerJS), fallback para áudio apenas |
| Performance FFMPEG | Média | Alto | Gravação assíncrona, limitar resoluções, usar workers |
| Escalabilidade MongoDB | Baixa | Médio | Indexação adequada, sharding (pós-MVP) |
| Segurança (XSS, CSRF) | Média | Alto | Seguir OWASP, code review, testes de segurança |
| Bugs em produção | Alta | Médio | Testes automatizados, CI/CD, logs detalhados |
| Atraso no cronograma | Alta | Médio | Priorizar MVP, iterações curtas, buffer no planejamento |

---

## 14. Glossário

- **MVP**: Minimum Viable Product (produto mínimo viável)
- **CRUD**: Create, Read, Update, Delete
- **JWT**: JSON Web Token
- **WebRTC**: Web Real-Time Communication
- **FFMPEG**: Framework de manipulação de vídeo/áudio
- **GridFS**: Sistema de arquivos do MongoDB para arquivos grandes
- **Socket.io**: Biblioteca de comunicação real-time
- **XSS**: Cross-Site Scripting
- **CSRF**: Cross-Site Request Forgery
- **OWASP**: Open Web Application Security Project
- **VPS**: Virtual Private Server

---

## 15. Referências

- [Codenames - Regras Oficiais](https://czechgames.com/files/rules/codenames-rules-en.pdf)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Socket.io Documentation](https://socket.io/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WebRTC Documentation](https://webrtc.org)
- [FFMPEG Documentation](https://ffmpeg.org/documentation.html)

---

## 16. Aprovações

| Stakeholder | Papel | Status | Data |
|-------------|-------|--------|------|
| [Nome] | Product Owner | Pendente | - |
| [Nome] | Tech Lead | Pendente | - |
| [Nome] | Designer | Pendente | - |
| [Nome] | QA Lead | Pendente | - |

---

**Versão**: 1.0  
**Data**: 18/11/2025  
**Autor**: [Seu Nome]  
**Última Atualização**: 18/11/2025
