import { Router } from 'express';
import { verifyToken, verifyAdmin } from '../middlewares/auth.middleware';
import {
  getAdminStatsController,
  getAllUsersController,
  updateUserRoleController,
  deleteUserController,
  getAllEquipmentAdminController,
  updateEquipmentStatusAdminController,
  getAllBookingsAdminController,
  getAllPaymentsAdminController,
  updateEquipmentAdminController,
  deleteEquipmentAdminController,
} from '../controllers/admin.controller';

const router = Router();

// Protect all admin routes
router.use(verifyToken, verifyAdmin);

router.get('/stats', getAdminStatsController);

// Users Management
router.get('/users', getAllUsersController);
router.patch('/users/:id/role', updateUserRoleController);
router.delete('/users/:id', deleteUserController);

// Equipment Moderation
router.get('/equipment', getAllEquipmentAdminController);
router.patch('/equipment/:id/status', updateEquipmentStatusAdminController);

// Bookings & Payments Monitoring
router.get('/bookings', getAllBookingsAdminController);
router.get('/payments', getAllPaymentsAdminController);



router.patch('/equipment/:id', updateEquipmentAdminController);
router.delete('/equipment/:id', deleteEquipmentAdminController);

export default router;