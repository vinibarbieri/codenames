import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import peerService from '../services/peerService';
import socket from '../services/socket';
import Button from './Button';

/**
 * VideoChat - Componente para videochat peer-to-peer usando WebRTC
 * @param {object} props
 * @param {string} props.userId - ID do usuário atual
 * @param {string} props.remotePeerId - ID do peer remoto (opcional, para iniciar chamada)
 * @param {boolean} props.isVisible - Controla visibilidade do componente
 * @param {function} props.onClose - Callback quando o videochat é fechado
 */
const VideoChat = ({ userId, remotePeerId, isVisible = true, onClose }) => {
  const { id: gameId } = useParams();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [peerId, setPeerId] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const mediaCallRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const localStreamRef = useRef(null);
  const handleIncomingCallRef = useRef(null);

  /**
   * Responde a uma chamada recebida
   */
  const handleIncomingCall = useCallback(call => {
    const currentStream = localStreamRef.current;
    if (!currentStream) {
      console.warn('[VideoChat] Chamada recebida mas stream local não disponível');
      call.close();
      return;
    }

    console.log('[VideoChat] Chamada recebida de:', call.peer);
    peerService.answer(call, currentStream);
    mediaCallRef.current = call;

    call.on('stream', stream => {
      console.log('[VideoChat] Stream remoto recebido na resposta');
      setRemoteStream(stream);
    });

    call.on('close', () => {
      console.log('[VideoChat] Chamada fechada');
      setRemoteStream(null);
      mediaCallRef.current = null;
    });

    call.on('error', err => {
      console.error('[VideoChat] Erro na chamada recebida:', err);
      setError('Erro na conexão de vídeo');
    });
  }, []);

  // Atualizar ref quando handleIncomingCall mudar
  useEffect(() => {
    handleIncomingCallRef.current = handleIncomingCall;
  }, [handleIncomingCall]);

  /**
   * Inicia uma chamada para um peer remoto
   */
  const startCall = useCallback(
    async targetPeerId => {
      const currentStream = localStreamRef.current;
      if (!currentStream || !peerService.isReady()) {
        console.error('[VideoChat] Stream local ou Peer não disponível');
        return;
      }

      try {
        const call = await peerService.call(targetPeerId, currentStream);
        mediaCallRef.current = call;

        call.on('stream', stream => {
          console.log('[VideoChat] Stream remoto recebido');
          setRemoteStream(stream);
        });

        call.on('close', () => {
          console.log('[VideoChat] Chamada fechada');
          setRemoteStream(null);
          mediaCallRef.current = null;
        });

        call.on('error', err => {
          console.error('[VideoChat] Erro na chamada:', err);
          setError('Erro na conexão de vídeo');
        });
      } catch (err) {
        console.error('[VideoChat] Erro ao iniciar chamada:', err);
        setError('Erro ao conectar com o oponente');
      }
    },
    []
  );

  // Inicializar Peer e capturar stream local
  useEffect(() => {
    if (!userId || !isVisible || hasInitializedRef.current) return;

    const initializeVideoChat = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Inicializar Peer
        let id = await peerService.initialize(userId);
        setPeerId(id);
        hasInitializedRef.current = true;

        // Compartilhar peerId via socket
        if (socket && socket.connected && gameId) {
          socket.emit('video:peerId', {
            gameId,
            peerId: id,
            fromUserId: userId,
          });
        }

        // Capturar stream local com fallback para apenas áudio
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          localStreamRef.current = stream;
          setLocalStream(stream);

          // Atualizar vídeo local
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (mediaError) {
          console.warn('[VideoChat] Erro ao acessar câmera, tentando apenas áudio:', mediaError);
          
          // Fallback: apenas áudio
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            localStreamRef.current = audioStream;
            setLocalStream(audioStream);
            setIsVideoOff(true);
          } catch (audioError) {
            console.error('[VideoChat] Erro ao acessar mídia:', audioError);
            setError('Não foi possível acessar câmera ou microfone');
          }
        }

        // Escutar chamadas recebidas usando ref atualizado
        if (handleIncomingCallRef.current) {
          peerService.onCall(handleIncomingCallRef.current);
        }
      } catch (err) {
        console.error('[VideoChat] Erro ao inicializar:', err);
        setError('Erro ao inicializar videochat');
      } finally {
        setIsLoading(false);
      }
    };

    initializeVideoChat();

    // Cleanup
    return () => {
      // Limpar stream local
      const currentStream = localStreamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Remover listener de chamadas
      if (handleIncomingCallRef.current) {
        peerService.offCall(handleIncomingCallRef.current);
      }

      // Fechar chamada ativa
      if (mediaCallRef.current) {
        mediaCallRef.current.close();
        mediaCallRef.current = null;
      }

      // Limpar vídeos
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      hasInitializedRef.current = false;
    };
  }, [userId, isVisible, gameId]);

  // Iniciar chamada quando remotePeerId for fornecido
  useEffect(() => {
    if (remotePeerId && localStreamRef.current && peerId && !mediaCallRef.current) {
      startCall(remotePeerId);
    }
  }, [remotePeerId, peerId, startCall]);

  // Atualizar vídeo remoto quando stream mudar
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /**
   * Alterna mute/unmute do áudio
   */
  const toggleMute = () => {
    const currentStream = localStreamRef.current;
    if (!currentStream) return;

    const audioTracks = currentStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !isMuted;
    });

    setIsMuted(!isMuted);
  };

  /**
   * Alterna ligar/desligar vídeo
   */
  const toggleVideo = () => {
    const currentStream = localStreamRef.current;
    if (!currentStream) return;

    const videoTracks = currentStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = isVideoOff;
    });

    setIsVideoOff(!isVideoOff);
  };

  /**
   * Fecha o videochat
   */
  const handleClose = () => {
    // Limpar stream local
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Remover listener de chamadas
    if (handleIncomingCallRef.current) {
      peerService.offCall(handleIncomingCallRef.current);
    }

    // Fechar chamada ativa
    if (mediaCallRef.current) {
      mediaCallRef.current.close();
      mediaCallRef.current = null;
    }

    // Limpar vídeos
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStream(null);
    hasInitializedRef.current = false;

    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-4 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Videochat</h3>
        {onClose && (
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fechar videochat"
          >
            ✕
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Inicializando videochat...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded p-3 mb-4 text-red-200">
          {error}
        </div>
      )}

      {!isLoading && localStream && (
        <div className="space-y-4">
          {/* Vídeos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vídeo Local */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-gray-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">Câmera desligada</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                Você
              </div>
            </div>

            {/* Vídeo Remoto */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-gray-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-2 animate-pulse"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">Aguardando conexão...</p>
                  </div>
                </div>
              )}
              {remoteStream && (
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                  Oponente
                </div>
              )}
            </div>
          </div>

          {/* Controles */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={toggleMute}
              variant={isMuted ? 'danger' : 'primary'}
              className="flex items-center gap-2"
            >
              {isMuted ? (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                  Desmutar
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  Mutar
                </>
              )}
            </Button>

            <Button
              onClick={toggleVideo}
              variant={isVideoOff ? 'danger' : 'primary'}
              className="flex items-center gap-2"
            >
              {isVideoOff ? (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Ligar Câmera
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Desligar Câmera
                </>
              )}
            </Button>
          </div>

          {peerId && (
            <div className="text-center text-xs text-gray-400">
              Seu ID: {peerId.substring(0, 8)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoChat;

