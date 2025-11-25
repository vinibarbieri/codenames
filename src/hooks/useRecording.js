import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Hook for managing game recording with MediaRecorder API
 * @param {string} gameId - Current game ID
 * @param {boolean} isGameActive - Whether the game is currently active
 * @returns {Object} Recording state and controls
 */
export const useRecording = (gameId, isGameActive = false) => {
  const { token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const durationIntervalRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const audioStreamRef = useRef(null);

  /**
   * Start recording timer
   */
  const startTimer = useCallback(() => {
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }, []);

  /**
   * Stop recording timer
   */
  const stopTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Cleanup media streams
   */
  const cleanupStreams = useCallback(() => {
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(track => track.stop());
      canvasStreamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  /**
   * Start recording
   * @param {HTMLCanvasElement} canvas - Game canvas element to capture
   * @param {Object} settings - Recording settings
   */
  const startRecording = useCallback(
    async (canvas, settings = {}) => {
      try {
        // Validate game is active
        if (!isGameActive) {
          throw new Error('Cannot record: game is not active');
        }

        // Clear any previous errors
        setError(null);

        // Request permission and capture audio from microphone
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100,
            },
          });
          audioStreamRef.current = audioStream;
        } catch {
          console.warn('Microphone access denied, recording without audio');
        }

        // Capture canvas stream
        if (!canvas || !canvas.captureStream) {
          throw new Error('Canvas not available for recording');
        }

        const fps = settings.fps || 24;
        canvasStreamRef.current = canvas.captureStream(fps);

        // Combine canvas and audio streams
        const combinedStream = new MediaStream();

        // Add video tracks from canvas
        canvasStreamRef.current
          .getVideoTracks()
          .forEach(track => combinedStream.addTrack(track));

        // Add audio tracks if available
        if (audioStreamRef.current) {
          audioStreamRef.current
            .getAudioTracks()
            .forEach(track => combinedStream.addTrack(track));
        }

        // Initialize MediaRecorder
        const options = {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 4000000, // 4Mbps
          audioBitsPerSecond: 128000, // 128kbps
        };

        // Fallback to supported mime types
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
          }
        }

        mediaRecorderRef.current = new MediaRecorder(combinedStream, options);
        chunksRef.current = [];

        // Collect video chunks
        mediaRecorderRef.current.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        // Handle recording stop
        mediaRecorderRef.current.onstop = async () => {
          stopTimer();
          await uploadRecording();
        };

        // Handle errors
        mediaRecorderRef.current.onerror = event => {
          console.error('MediaRecorder error:', event.error);
          setError(`Recording error: ${event.error.message}`);
          cleanupStreams();
        };

        // Start backend recording session
        const response = await fetch(`${API_URL}/recordings/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            gameId,
            settings: {
              videoBitrate: `${options.videoBitsPerSecond / 1000}k`,
              fps,
              audioBitrate: `${options.audioBitsPerSecond / 1000}k`,
              fullScreen: settings.fullScreen || false,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to start recording');
        }

        const data = await response.json();
        setRecordingId(data.data.recordingId);

        // Start MediaRecorder
        mediaRecorderRef.current.start(1000); // Collect chunks every second
        setIsRecording(true);
        startTimer();

        return data.data.recordingId;
      } catch (err) {
        console.error('Failed to start recording:', err);
        setError(err.message);
        cleanupStreams();
        throw err;
      }
    },
    [gameId, isGameActive, token, stopTimer, cleanupStreams, startTimer]
  );

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    try {
      if (!mediaRecorderRef.current || !isRecording) {
        return;
      }

      // Stop MediaRecorder (will trigger onstop event)
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError(err.message);
      cleanupStreams();
      throw err;
    }
  }, [isRecording, cleanupStreams, uploadRecording]);

  /**
   * Upload recorded video to backend
   */
  const uploadRecording = useCallback(async () => {
    try {
      if (!recordingId || chunksRef.current.length === 0) {
        throw new Error('No recording data to upload');
      }

      // Combine chunks into single blob
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });

      // Create FormData for upload
      const formData = new FormData();
      formData.append('video', videoBlob, 'recording.webm');
      formData.append('recordingId', recordingId);

      // Upload to backend
      const response = await fetch(`${API_URL}/recordings/stop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload recording');
      }

      const data = await response.json();
      console.log('Recording uploaded successfully:', data);

      // Cleanup
      cleanupStreams();
      chunksRef.current = [];

      return data.data;
    } catch (err) {
      console.error('Failed to upload recording:', err);
      setError(err.message);
      cleanupStreams();
      throw err;
    }
  }, [recordingId, token, cleanupStreams]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [isRecording, stopTimer]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [isRecording, isPaused, startTimer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStreams();
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording, stopTimer, cleanupStreams]);

  return {
    isRecording,
    recordingId,
    error,
    duration,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
};

export default useRecording;
