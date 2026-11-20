import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import app from './app';
import { connectToMongoDB } from './config/db';
import { ensureDatabaseIndexes } from './config/indexes';

dotenv.config();

let initPromise: Promise<void> | null = null;

const initializeServer = (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      await connectToMongoDB();
      await ensureDatabaseIndexes();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

// Run standard HTTP server only in local environment
if (process.env.VERCEL !== '1') {
  const port = process.env.PORT || 5000;
  initializeServer()
    .then(() => {
      app.listen(port, () => {
        console.log(`EquipVault Server listening on http://localhost:${port}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err);
      process.exit(1);
    });
}

// Export serverless handler for Vercel
export default async function handler(req: Request, res: Response) {
  try {
    await initializeServer();
    return app(req, res);
  } catch (err) {
    console.error('Server initialization error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database on server.',
    });
  }
}