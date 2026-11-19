import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import {
  getOwnerOverviewController,
  getCustomerOverviewController,
} from '../controllers/dashboard.controller';

const router = Router();

router.get('/owner-overview', verifyToken, verifyOwner, getOwnerOverviewController);
router.get('/customer-overview', verifyToken, getCustomerOverviewController);

export default router;