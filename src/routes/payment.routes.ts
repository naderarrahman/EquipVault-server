import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  createCheckoutSessionController,
  verifyPaymentSessionController,
  getMyPaymentsController,
} from '../controllers/payment.controller';

const router = Router();

router.post('/create-checkout-session', verifyToken, createCheckoutSessionController);
router.post('/verify-session', verifyToken, verifyPaymentSessionController);
router.get('/my-payments', verifyToken, getMyPaymentsController);

export default router;