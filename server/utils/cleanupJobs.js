import cron from 'node-cron';
import Recording from '../models/Recording.js';
import { getGridFSBucket } from '../config/gridfs.js';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure logger for cleanup jobs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/cleanup.log'),
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Delete expired recordings cronjob
 * Runs daily at 3:00 AM
 */
export const startRecordingCleanupJob = () => {
  // Schedule: Every day at 3:00 AM (America/Sao_Paulo timezone)
  cron.schedule(
    '0 3 * * *',
    async () => {
      try {
        logger.info('Starting expired recordings cleanup job...');

        const bucket = getGridFSBucket();
        const deletedCount = await Recording.deleteExpiredRecordings(bucket);

        logger.info(
          `Cleanup job completed. Deleted ${deletedCount} expired recordings.`
        );
      } catch (error) {
        logger.error(`Cleanup job failed: ${error.message}`, {
          error: error.stack,
        });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );

  logger.info(
    '✅ Recording cleanup job scheduled (daily at 3:00 AM America/Sao_Paulo)'
  );
};

/**
 * Initialize all cleanup jobs
 */
export const initializeCleanupJobs = () => {
  try {
    startRecordingCleanupJob();
    logger.info('✅ All cleanup jobs initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize cleanup jobs: ${error.message}`);
    throw error;
  }
};

export default {
  initializeCleanupJobs,
  startRecordingCleanupJob,
};
