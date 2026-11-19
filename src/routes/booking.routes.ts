import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import {
  createBookingController,
  getMyBookingsController,
  cancelMyBookingController,
  getOwnerBookingsController,
  updateBookingStatusController,
} from '../controllers/booking.controller';

const router = Router();

// Customer Routes
router.post('/', verifyToken, createBookingController);
router.get('/my-bookings', verifyToken, getMyBookingsController);
router.patch('/:id/cancel', verifyToken, cancelMyBookingController);

// Owner Routes
router.get('/owner', verifyToken, verifyOwner, getOwnerBookingsController);
router.patch('/:id/status', verifyToken, verifyOwner, updateBookingStatusController);

export default router;