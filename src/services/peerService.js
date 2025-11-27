import Peer from 'peerjs';

/**
 * PeerService - Gerencia instâncias de Peer para WebRTC
 */
class PeerService {
  constructor() {
    this.peer = null;
    this.peerId = null;
    this.isInitialized = false;
    this.connections = new Map();
    this.onConnectionCallbacks = [];
  }

  /**
   * Inicializa uma nova instância de Peer
   * @param {string} userId - ID único do usuário
   * @param {object} options - Opções de configuração
   * @returns {Promise<string>} - Peer ID gerado
   */
  async initialize(userId, options = {}) {
    if (this.isInitialized && this.peer) {
      return this.peerId;
    }

    return new Promise((resolve, reject) => {
      try {
        // Configuração padrão: usar servidor público do PeerJS
        // Pode ser sobrescrito com options para usar servidor próprio
        const config = {
          host: options.host || '0.peerjs.com',
          port: options.port || 443,
          path: options.path || '/',
          secure: options.secure !== undefined ? options.secure : true,
          debug: options.debug || 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        };

        this.peer = new Peer(userId, config);

        this.peer.on('open', id => {
          console.log('[PeerService] Peer conectado com ID:', id);
          this.peerId = id;
          this.isInitialized = true;
          resolve(id);
        });

        this.peer.on('error', error => {
          console.error('[PeerService] Erro no Peer:', error);
          if (error.type === 'peer-unavailable') {
            // Tentar reconectar após 2 segundos
            setTimeout(() => {
              this.reconnect(userId, options);
            }, 2000);
          }
          reject(error);
        });

        this.peer.on('connection', conn => {
          console.log('[PeerService] Nova conexão recebida:', conn.peer);
          this.connections.set(conn.peer, conn);
          this.onConnectionCallbacks.forEach(callback => callback(conn));
        });

        this.peer.on('disconnected', () => {
          console.log('[PeerService] Peer desconectado, tentando reconectar...');
          if (!this.peer.destroyed) {
            this.peer.reconnect();
          }
        });

        this.peer.on('close', () => {
          console.log('[PeerService] Peer fechado');
          this.isInitialized = false;
          this.peerId = null;
        });
      } catch (error) {
        console.error('[PeerService] Erro ao inicializar:', error);
        reject(error);
      }
    });
  }

  /**
   * Reconecta o Peer
   */
  async reconnect(userId, options = {}) {
    this.destroy();
    return this.initialize(userId, options);
  }

  /**
   * Conecta a um peer remoto
   * @param {string} remotePeerId - ID do peer remoto
   * @returns {Promise<DataConnection>} - Conexão estabelecida
   */
  async connect(remotePeerId) {
    if (!this.isInitialized || !this.peer) {
      throw new Error('Peer não inicializado. Chame initialize() primeiro.');
    }

    return new Promise((resolve, reject) => {
      try {
        const conn = this.peer.connect(remotePeerId, {
          reliable: true,
        });

        conn.on('open', () => {
          console.log('[PeerService] Conexão estabelecida com:', remotePeerId);
          this.connections.set(remotePeerId, conn);
          resolve(conn);
        });

        conn.on('error', error => {
          console.error('[PeerService] Erro na conexão:', error);
          this.connections.delete(remotePeerId);
          reject(error);
        });

        conn.on('close', () => {
          console.log('[PeerService] Conexão fechada com:', remotePeerId);
          this.connections.delete(remotePeerId);
        });
      } catch (error) {
        console.error('[PeerService] Erro ao conectar:', error);
        reject(error);
      }
    });
  }

  /**
   * Faz uma chamada de vídeo/áudio para um peer remoto
   * @param {string} remotePeerId - ID do peer remoto
   * @param {MediaStream} localStream - Stream local de mídia
   * @returns {Promise<MediaConnection>} - Conexão de mídia
   */
  async call(remotePeerId, localStream) {
    if (!this.isInitialized || !this.peer) {
      throw new Error('Peer não inicializado. Chame initialize() primeiro.');
    }

    return new Promise((resolve, reject) => {
      try {
        const call = this.peer.call(remotePeerId, localStream);

        call.on('stream', () => {
          console.log('[PeerService] Stream remoto recebido de:', remotePeerId);
          resolve(call);
        });

        call.on('error', error => {
          console.error('[PeerService] Erro na chamada:', error);
          reject(error);
        });

        call.on('close', () => {
          console.log('[PeerService] Chamada fechada com:', remotePeerId);
        });
      } catch (error) {
        console.error('[PeerService] Erro ao fazer chamada:', error);
        reject(error);
      }
    });
  }

  /**
   * Responde a uma chamada recebida
   * @param {MediaConnection} call - Chamada recebida
   * @param {MediaStream} localStream - Stream local de mídia
   */
  answer(call, localStream) {
    call.answer(localStream);
    call.on('stream', () => {
      console.log('[PeerService] Stream remoto recebido na resposta');
    });
  }

  /**
   * Registra callback para novas conexões
   */
  onConnection(callback) {
    this.onConnectionCallbacks.push(callback);
  }

  /**
   * Remove callback de conexão
   */
  offConnection(callback) {
    this.onConnectionCallbacks = this.onConnectionCallbacks.filter(
      cb => cb !== callback
    );
  }

  /**
   * Obtém o ID do peer atual
   */
  getPeerId() {
    return this.peerId;
  }

  /**
   * Verifica se o peer está inicializado
   */
  isReady() {
    return this.isInitialized && this.peer && !this.peer.destroyed;
  }

  /**
   * Destrói a instância do Peer e limpa recursos
   */
  destroy() {
    if (this.peer) {
      // Fechar todas as conexões
      this.connections.forEach(conn => {
        if (conn.close) conn.close();
        if (conn.end) conn.end();
      });
      this.connections.clear();

      // Destruir peer
      if (!this.peer.destroyed) {
        this.peer.destroy();
      }
      this.peer = null;
    }

    this.isInitialized = false;
    this.peerId = null;
    this.onConnectionCallbacks = [];
  }
}

// Exportar instância singleton
const peerService = new PeerService();
export default peerService;

