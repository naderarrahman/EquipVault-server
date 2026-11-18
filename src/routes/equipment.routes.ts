import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import { createEquipmentController, getMyEquipmentController } from '../controllers/equipment.controller';

const router = Router();

router.post('/', verifyToken, verifyOwner, createEquipmentController);

router.get('/my-equipment', verifyToken, verifyOwner, getMyEquipmentController);

export default router;