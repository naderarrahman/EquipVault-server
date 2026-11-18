import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

export const createEquipmentController = async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;

    const newEquipment = {
      ...req.body,
      status: 'pending', 
      ownerId,
      ownerName: req.user?.name || 'Verified Owner',
      ownerEmail: req.user?.email || '',
      createdAt: new Date(),
    };

    const result = await equipmentCollection.insertOne(newEquipment);

    return res.status(201).json({
      success: true,
      message: 'Equipment submitted successfully. Pending admin approval.',
      insertedId: result.insertedId,
      data: newEquipment,
    });
  } catch (error) {
    console.error('Error in createEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};