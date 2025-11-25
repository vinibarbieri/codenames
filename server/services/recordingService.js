import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import Recording from '../models/Recording.js';
import { uploadToGridFS } from '../utils/gridfs.js';

const execAsync = promisify(exec);

// Armazenamento de gravações em andamento
const activeRecordings = new Map();

// Limite de storage por usuário (1GB em bytes)
const MAX_STORAGE_PER_USER = 1024 * 1024 * 1024; // 1GB

/**
 * Verifica se FFMPEG está instalado no sistema
 * @returns {Promise<boolean>} - true se FFMPEG está disponível
 */
export const checkFFMPEGInstallation = async () => {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    console.error('FFMPEG not found:', error.message);
    return false;
  }
};

/**
 * Calcula o tamanho total de storage usado por um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<number>} - Tamanho total em bytes
 */
const calculateUserStorage = async (userId) => {
  const recordings = await Recording.find({ userId }).select('size');
  return recordings.reduce((total, recording) => total + (recording.size || 0), 0);
};

/**
 * Verifica se o usuário pode iniciar uma nova gravação (dentro do limite de storage)
 * @param {string} userId - ID do usuário
 * @returns {Promise<{allowed: boolean, currentStorage: number, maxStorage: number}>}
 */
export const checkStorageLimit = async (userId) => {
  const currentStorage = await calculateUserStorage(userId);
  return {
    allowed: currentStorage < MAX_STORAGE_PER_USER,
    currentStorage,
    maxStorage: MAX_STORAGE_PER_USER,
  };
};

/**
 * Inicia uma gravação de vídeo (prepara para receber upload)
 * @param {string} userId - ID do usuário
 * @param {string} gameId - ID do jogo
 * @param {Object} settings - Configurações de gravação
 * @returns {Promise<{recordingId: string}>}
 */
export const startRecording = async (userId, gameId, settings = {}) => {
  // Verificar instalação do FFMPEG
  const ffmpegInstalled = await checkFFMPEGInstallation();
  if (!ffmpegInstalled) {
    throw new Error('FFMPEG is not installed on the server');
  }

  // Verificar limite de storage
  const storageCheck = await checkStorageLimit(userId);
  if (!storageCheck.allowed) {
    throw new Error(
      `Storage limit exceeded. Current: ${(storageCheck.currentStorage / 1024 / 1024).toFixed(2)}MB, Max: ${(storageCheck.maxStorage / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // Gerar ID único para a gravação
  const recordingId = randomUUID();

  // Configurações padrão
  const recordingSettings = {
    videoBitrate: settings.videoBitrate || '4000k',
    fps: settings.fps || 24,
    audioBitrate: settings.audioBitrate || '128k',
    fullScreen: settings.fullScreen || false,
  };

  // Armazenar informações da gravação (aguardando upload)
  activeRecordings.set(recordingId, {
    userId,
    gameId,
    settings: recordingSettings,
    startTime: Date.now(),
  });

  return {
    recordingId,
  };
};

/**
 * Para uma gravação e salva no GridFS (recebe arquivo do frontend)
 * @param {string} recordingId - ID da gravação
 * @param {Buffer} videoBuffer - Buffer do vídeo gravado
 * @param {number} duration - Duração em segundos
 * @returns {Promise<Recording>} - Documento Recording criado
 */
export const stopRecording = async (recordingId, videoBuffer, duration) => {
  const recordingData = activeRecordings.get(recordingId);
  if (!recordingData) {
    throw new Error('Recording not found or already stopped');
  }

  const { userId, gameId, settings } = recordingData;

  try {
    // Processar vídeo (comprimir se necessário)
    const processedBuffer = await processVideo(videoBuffer);

    // Upload para GridFS
    const filename = `recording-${recordingId}-${Date.now()}.webm`;
    const fileId = await uploadToGridFS(processedBuffer, filename, {
      userId,
      gameId,
      recordingId,
    });

    // Criar documento Recording
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15); // 15 dias

    const recording = new Recording({
      gameId,
      userId,
      fileId,
      filename,
      duration,
      size: processedBuffer.length,
      format: 'webm',
      settings,
      expiresAt,
    });

    // Gerar shareUrl
    recording.generateShareUrl();

    await recording.save();

    // Remover da lista de gravações ativas
    activeRecordings.delete(recordingId);

    return recording;
  } catch (error) {
    // Limpar em caso de erro
    activeRecordings.delete(recordingId);
    throw error;
  }
};

/**
 * Processa e comprime um vídeo usando FFMPEG
 * @param {Buffer} fileBuffer - Buffer do arquivo de vídeo
 * @returns {Promise<Buffer>} - Buffer do vídeo processado
 */
export const processVideo = async (fileBuffer) => {
  // Verificar se FFMPEG está disponível
  const ffmpegInstalled = await checkFFMPEGInstallation();
  if (!ffmpegInstalled) {
    // Se FFMPEG não estiver disponível, retornar buffer original
    return fileBuffer;
  }

  // Salvar buffer em arquivo temporário
  const inputPath = join(tmpdir(), `input-${randomUUID()}.webm`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.webm`);

  try {
    const fs = await import('fs/promises');
    await fs.writeFile(inputPath, fileBuffer);

    // Comprimir vídeo com FFMPEG usando preset 'medium'
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libvpx-vp9')
        .audioCodec('libopus')
        .outputOptions(['-preset medium', '-crf 23'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Ler arquivo comprimido
    const processedBuffer = await fs.readFile(outputPath);

    // Limpar arquivos temporários
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    return processedBuffer;
  } catch (error) {
    console.error('Error processing video:', error);
    // Em caso de erro, retornar buffer original
    const fs = await import('fs/promises');
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    return fileBuffer;
  }
};

/**
 * Obtém informações de uma gravação ativa
 * @param {string} recordingId - ID da gravação
 * @returns {Object|null} - Dados da gravação ou null se não encontrada
 */
export const getActiveRecording = (recordingId) => {
  return activeRecordings.get(recordingId) || null;
};

/**
 * Verifica se uma gravação está ativa
 * @param {string} recordingId - ID da gravação
 * @returns {boolean}
 */
export const isRecordingActive = (recordingId) => {
  return activeRecordings.has(recordingId);
};

