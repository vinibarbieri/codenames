import { useState, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getToken = () => localStorage.getItem('token');

/**
 * Hook para gerenciar gravação de vídeo
 * @param {string} gameId - ID do jogo
 * @returns {Object} - Estado e funções de gravação
 */
export const useRecording = (gameId) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const durationIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const recordingIdRef = useRef(null);
  const videoChunksRef = useRef([]);

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  /**
   * Inicia a gravação
   */
  const startRecording = async () => {
    try {
      setError(null);

      // Verificar se a API está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não suporta gravação de áudio. Por favor, use um navegador moderno.');
      }

      // Verificar se há dispositivos de áudio disponíveis
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        if (audioDevices.length === 0) {
          throw new Error('Nenhum dispositivo de áudio encontrado. Verifique se há um microfone conectado.');
        }
      } catch (enumError) {
        // Se não conseguir enumerar dispositivos, continua mesmo assim
        // (pode ser que precise de permissão primeiro)
        console.warn('Não foi possível enumerar dispositivos:', enumError);
      }

      // Solicitar permissão de microfone
      let stream;
      try {
        // Tentar primeiro com configurações ideais
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        } catch (idealError) {
          // Se falhar, tentar com configurações mínimas
          console.warn('Falha ao obter stream com configurações ideais, tentando configurações mínimas:', idealError);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true, // Configuração mínima
            video: false,
          });
        }
      } catch (mediaError) {
        // Tratar erros específicos do getUserMedia
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          throw new Error('Permissão de microfone negada. Por favor, permita o acesso ao microfone nas configurações do navegador.');
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          throw new Error('Nenhum dispositivo de áudio encontrado. Verifique se há um microfone conectado e tente novamente.');
        } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
          throw new Error('Não foi possível acessar o microfone. Verifique se ele não está sendo usado por outro aplicativo.');
        } else if (mediaError.name === 'OverconstrainedError' || mediaError.name === 'ConstraintNotSatisfiedError') {
          throw new Error('As configurações de áudio solicitadas não são suportadas pelo seu dispositivo.');
        } else {
          throw new Error(`Erro ao acessar o microfone: ${mediaError.message || 'Erro desconhecido'}`);
        }
      }

      // Verificar se o stream tem tracks de áudio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Nenhuma track de áudio disponível no stream.');
      }

      // Capturar canvas do jogo (se disponível)
      // Por enquanto, vamos apenas gravar áudio
      // TODO: Adicionar captura de canvas quando disponível

      // Verificar codecs suportados
      const supportedMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];

      let selectedMimeType = 'video/webm';
      for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      // Criar MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });

      // Limpar chunks anteriores
      videoChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          // Combinar chunks em um Blob
          const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          
          // Usar o recordingId da ref para garantir que temos o valor mais recente
          const currentRecordingId = recordingIdRef.current;
          
          if (!currentRecordingId) {
            console.error('Recording ID não encontrado ao parar gravação');
            setError('Erro: ID de gravação não encontrado');
            setIsRecording(false);
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          
          // Parar gravação no backend
          await stopRecordingBackend(blob, currentRecordingId);
          
          // Parar todas as tracks
          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error('Erro ao processar gravação:', err);
          setError(err.message || 'Erro ao processar gravação');
          setIsRecording(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        const errorMessage = event.error?.message || 'Erro desconhecido ao gravar';
        setError(`Erro ao gravar: ${errorMessage}`);
        setIsRecording(false);
        
        // Parar todas as tracks em caso de erro
        stream.getTracks().forEach((track) => track.stop());
        
        // Limpar estado
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
        setMediaRecorder(null);
        setRecordingId(null);
        recordingIdRef.current = null;
        startTimeRef.current = null;
        videoChunksRef.current = [];
      };

      // Iniciar gravação no backend
      const token = getToken();
      const response = await fetch(`${API_URL}/recordings/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId,
          settings: {
            videoBitrate: '4000k',
            fps: 24,
            audioBitrate: '128k',
            fullScreen: false,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao iniciar gravação');
      }

      const result = await response.json();
      const newRecordingId = result.data.recordingId;

      // Definir recordingId na ref e no state
      recordingIdRef.current = newRecordingId;
      setRecordingId(newRecordingId);

      // Iniciar MediaRecorder
      recorder.start(1000); // Coletar chunks a cada 1 segundo

      // Limpar qualquer intervalo anterior
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Definir estado ANTES de iniciar o timer
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Iniciar timer
      startTimeRef.current = Date.now();
      setDuration(0); // Resetar duração para começar do zero

      // Iniciar timer de duração (atualiza a cada segundo)
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(elapsed);
        }
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      
      // Mensagem de erro mais amigável
      let errorMessage = 'Erro ao iniciar gravação';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.name === 'NotAllowedError') {
        errorMessage = 'Permissão de microfone negada. Por favor, permita o acesso ao microfone.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhum dispositivo de áudio encontrado. Verifique se há um microfone conectado.';
      }
      
      setError(errorMessage);
      setIsRecording(false);
      
      // Limpar estado em caso de erro
      setMediaRecorder(null);
      setRecordingId(null);
      recordingIdRef.current = null;
      setDuration(0);
      startTimeRef.current = null;
      videoChunksRef.current = [];
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      // Parar stream se foi criado
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  };

  /**
   * Para a gravação no backend
   */
  const stopRecordingBackend = async (blob, recordingIdToUse) => {
    try {
      // Usar o recordingId passado como parâmetro ou da ref
      const currentRecordingId = recordingIdToUse || recordingIdRef.current;
      
      if (!currentRecordingId) {
        throw new Error('Nenhuma gravação ativa');
      }

      setError(null);

      // Parar MediaRecorder se ainda estiver ativo
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      // Parar timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Enviar vídeo para o backend
      const token = getToken();
      const formData = new FormData();
      formData.append('video', blob, 'recording.webm');
      formData.append('recordingId', currentRecordingId);

      const response = await fetch(`${API_URL}/recordings/stop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao parar gravação');
      }

      const result = await response.json();
      
      // Limpar estado
      setIsRecording(false);
      setRecordingId(null);
      recordingIdRef.current = null;
      setDuration(0);
      startTimeRef.current = null;
      videoChunksRef.current = [];

      return result.data;
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(err.message || 'Erro ao parar gravação');
      setIsRecording(false);
      throw err;
    }
  };

  /**
   * Para a gravação manualmente (chamado pelo usuário)
   */
  const handleStopRecording = async () => {
    try {
      // Parar MediaRecorder se estiver ativo
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        // O onstop do MediaRecorder vai chamar stopRecordingBackend
      } else {
        // Se o MediaRecorder já parou ou não existe, limpar estado manualmente
        console.warn('MediaRecorder não está ativo, limpando estado');
        setIsRecording(false);
        setDuration(0);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Erro ao parar gravação:', err);
      setError(err.message || 'Erro ao parar gravação');
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    recordingId,
    error,
    duration,
    startRecording,
    stopRecording: handleStopRecording,
  };
};

