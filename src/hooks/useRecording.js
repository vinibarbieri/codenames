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

      // Solicitar permissão de microfone e câmera
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false, // Não precisamos de vídeo da câmera, apenas áudio
      });

      // Capturar canvas do jogo (se disponível)
      // Por enquanto, vamos apenas gravar áudio
      // TODO: Adicionar captura de canvas quando disponível

      // Criar MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });

      const videoChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Combinar chunks em um Blob
        const blob = new Blob(videoChunks, { type: 'video/webm' });
        
        // Parar gravação no backend
        await stopRecordingBackend(blob);
        
        // Parar todas as tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Erro ao gravar vídeo');
        setIsRecording(false);
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

      // Iniciar MediaRecorder
      recorder.start(1000); // Coletar chunks a cada 1 segundo

      setMediaRecorder(recorder);
      setRecordingId(newRecordingId);
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Iniciar timer de duração
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Erro ao iniciar gravação');
      setIsRecording(false);
    }
  };

  /**
   * Para a gravação no backend
   */
  const stopRecordingBackend = async (blob) => {
    try {
      if (!recordingId) {
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
      formData.append('recordingId', recordingId);

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
      
      setIsRecording(false);
      setRecordingId(null);
      setDuration(0);
      startTimeRef.current = null;

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
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
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

