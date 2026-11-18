import dotenv from 'dotenv';
import app from './app';
import { connectToMongoDB } from './config/db'; 

dotenv.config();

const port = process.env.PORT || 5000;

connectToMongoDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`EquipVault Server listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });