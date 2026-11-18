import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is missing in .env file');
}

const client = new MongoClient(uri);
let db: Db;

export async function connectToMongoDB(): Promise<Db> {
  if (db) return db;

  await client.connect();
  db = client.db('EquipVault');
  console.log(' You successfully connected to MongoDB!');
  return db;
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectToMongoDB() first.');
  }
  return db;
}