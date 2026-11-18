import { Router } from 'express';
import { verifyToken, verifyOwner } from '../middlewares/auth.middleware';
import { createEquipmentController } from '../controllers/equipment.controller';

const router = Router();

router.post('/', verifyToken, verifyOwner, createEquipmentController);

export default router;