import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import equipmentRoutes from './routes/equipment.routes';
import favoriteRoutes from './routes/favorite.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';

dotenv.config();

const app: Application = express();

const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Active Routes
app.use('/api/equipment', equipmentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'EquipVault Server is running smoothly!',
    timestamp: new Date().toISOString(),
  });
});

export default app;