import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import { createEquipmentController, getAllEquipmentController, getMyEquipmentController, getSingleEquipmentController } from '../controllers/equipment.controller';

const router = Router();

router.post('/', verifyToken, verifyOwner, createEquipmentController);

router.get('/my-equipment', verifyToken, verifyOwner, getMyEquipmentController);

router.get('/', getAllEquipmentController);

router.get('/:id', verifyToken, getSingleEquipmentController);

export default router;