import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let gridfsBucket = null;

/**
 * Inicializa o GridFS bucket para armazenamento de arquivos
 * @param {string} bucketName - Nome do bucket (padrão: 'recordings')
 * @returns {GridFSBucket} - Instância do GridFSBucket
 */
export const initGridFS = (bucketName = 'recordings') => {
  if (!gridfsBucket) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established. Call initGridFS after connecting to MongoDB.');
    }
    gridfsBucket = new GridFSBucket(db, {
      bucketName,
    });
  }
  return gridfsBucket;
};

/**
 * Obtém a instância do GridFS bucket
 * @returns {GridFSBucket} - Instância do GridFSBucket
 */
export const getGridFSBucket = () => {
  if (!gridfsBucket) {
    return initGridFS();
  }
  return gridfsBucket;
};

/**
 * Faz upload de um arquivo para GridFS
 * @param {Buffer|Stream} fileData - Dados do arquivo (Buffer ou Stream)
 * @param {string} filename - Nome do arquivo
 * @param {Object} metadata - Metadados opcionais
 * @returns {Promise<ObjectId>} - ID do arquivo no GridFS
 */
export const uploadToGridFS = async (fileData, filename, metadata = {}) => {
  const bucket = getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata,
    });

    if (Buffer.isBuffer(fileData)) {
      uploadStream.end(fileData);
    } else {
      fileData.pipe(uploadStream);
    }

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });
  });
};

/**
 * Faz download de um arquivo do GridFS
 * @param {ObjectId} fileId - ID do arquivo no GridFS
 * @returns {Promise<ReadableStream>} - Stream de leitura do arquivo
 */
export const downloadFromGridFS = (fileId) => {
  const bucket = getGridFSBucket();
  return bucket.openDownloadStream(fileId);
};

/**
 * Deleta um arquivo do GridFS
 * @param {ObjectId} fileId - ID do arquivo no GridFS
 * @returns {Promise<void>}
 */
export const deleteFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  return new Promise((resolve, reject) => {
    bucket.delete(fileId, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Obtém informações de um arquivo no GridFS
 * @param {ObjectId} fileId - ID do arquivo no GridFS
 * @returns {Promise<Object>} - Informações do arquivo
 */
export const getFileInfo = async (fileId) => {
  const bucket = getGridFSBucket();
  const files = await bucket.find({ _id: fileId }).toArray();
  return files[0] || null;
};

