import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import {
  getOwnerOverviewController,
  getCustomerOverviewController,
  getMyContactProfileController,
  updateMyContactProfileController,
} from '../controllers/dashboard.controller';

const router = Router();

router.get('/owner-overview', verifyToken, verifyOwner, getOwnerOverviewController);
router.get('/customer-overview', verifyToken, getCustomerOverviewController);

router.get('/profile-contact', verifyToken, getMyContactProfileController);
router.patch('/profile-contact', verifyToken, updateMyContactProfileController);

export default router;