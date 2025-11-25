import mongoose from 'mongoose';

let gridfsBucket = null;

/**
 * Initialize GridFS bucket
 * Must be called after mongoose connection is established
 */
export const initializeGridFS = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'Cannot initialize GridFS: MongoDB connection not established'
    );
  }

  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'recordings',
  });

  console.log('✅ GridFS bucket initialized');
  return gridfsBucket;
};

/**
 * Get GridFS bucket instance
 * @returns {GridFSBucket} GridFS bucket instance
 * @throws {Error} If GridFS has not been initialized
 */
export const getGridFSBucket = () => {
  if (!gridfsBucket) {
    throw new Error('GridFS bucket not initialized. Call initializeGridFS() first.');
  }
  return gridfsBucket;
};

/**
 * Upload a file to GridFS
 * @param {string} filename - Name of the file
 * @param {ReadableStream} readableStream - Stream to read file from
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<ObjectId>} File ID in GridFS
 */
export const uploadToGridFS = (filename, readableStream, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      metadata,
    });

    readableStream.pipe(uploadStream);

    uploadStream.on('error', error => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });
  });
};

/**
 * Download a file from GridFS
 * @param {ObjectId} fileId - File ID in GridFS
 * @returns {ReadableStream} Download stream
 */
export const downloadFromGridFS = fileId => {
  const bucket = getGridFSBucket();
  return bucket.openDownloadStream(fileId);
};

/**
 * Delete a file from GridFS
 * @param {ObjectId} fileId - File ID to delete
 * @returns {Promise<void>}
 */
export const deleteFromGridFS = async fileId => {
  const bucket = getGridFSBucket();
  await bucket.delete(fileId);
};

/**
 * Get file metadata from GridFS
 * @param {ObjectId} fileId - File ID
 * @returns {Promise<Object>} File metadata
 */
export const getFileMetadata = async fileId => {
  const bucket = getGridFSBucket();
  const files = await bucket.find({ _id: fileId }).toArray();
  return files.length > 0 ? files[0] : null;
};

export default {
  initializeGridFS,
  getGridFSBucket,
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
  getFileMetadata,
};
