import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is missing in environment variables');
}

const client = new MongoClient(uri);
let db: Db | null = null;
let connectPromise: Promise<Db> | null = null;

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db;

  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(() => {
        db = client.db('EquipVault');
        console.log('You successfully connected to MongoDB!');
        return db;
      })
      .catch((err) => {
        connectPromise = null;
        throw err;
      });
  }

  return connectPromise;
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectToMongoDB() first.');
  }
  return db;
}