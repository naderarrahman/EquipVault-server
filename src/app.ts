import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import equipmentRoutes from './routes/equipment.routes';
import favoriteRoutes from './routes/favorite.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import dashboardRoutes from './routes/dashboard.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import {
  notFoundHandler,
  globalErrorHandler,
} from './middlewares/error.middleware';

dotenv.config();

const app: Application = express();

// Trust Vercel / reverse proxy headers in production
app.set('trust proxy', 1);

// Restore original API path when rewritten via Vercel /api/index.cjs
app.use((req: Request, _res: Response, next: NextFunction) => {
  const rawUrl = req.url || req.originalUrl || '';
  if (
    rawUrl.startsWith('/api/index.cjs') ||
    rawUrl.includes('__vercel_path=')
  ) {
    const parsedUrl = new URL(rawUrl, 'http://localhost');
    const originalPath =
      parsedUrl.searchParams.get('__vercel_path') ??
      parsedUrl.searchParams.get('path') ??
      '';
    parsedUrl.searchParams.delete('__vercel_path');
    parsedUrl.searchParams.delete('path');

    const remainingQuery = parsedUrl.searchParams.toString();
    const cleanPath = originalPath.replace(/^\/+/, '');
    const restoredUrl = `/${cleanPath}${remainingQuery ? `?${remainingQuery}` : ''}`;

    req.url = restoredUrl;
    req.originalUrl = restoredUrl;
  }
  next();
});

const allowedOrigins: string[] = [
  'http://localhost:3000',
  (process.env.CLIENT_URL || '').replace(/\/+$/, ''),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/+$/, '') : '';
      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
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

// Health Check Route (must stay above notFoundHandler)
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'EquipVault Server is running smoothly!',
    timestamp: new Date().toISOString(),
  });
});

// Active API Routes
app.use('/api/equipment', equipmentRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// 404 & Global Error Middlewares
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;