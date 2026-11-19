import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import {
  createEquipmentController,
  getAllEquipmentController,
  getMyEquipmentController,
  getSingleEquipmentController,
  updateEquipmentController,
  deleteEquipmentController,
} from '../controllers/equipment.controller';

const router = Router();

// Public Marketplace
router.get('/', getAllEquipmentController);

// Protected Owner Routes (Must be above /:id)
router.post('/', verifyToken, verifyOwner, createEquipmentController);
router.get('/my-equipment', verifyToken, verifyOwner, getMyEquipmentController);

// Single Equipment Details (Any logged-in user)
router.get('/:id', verifyToken, getSingleEquipmentController);

// Owner Edit & Delete Own Equipment
router.patch('/:id', verifyToken, verifyOwner, updateEquipmentController);
router.delete('/:id', verifyToken, verifyOwner, deleteEquipmentController);

export default router;