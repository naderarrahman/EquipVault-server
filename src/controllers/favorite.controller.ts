import { Response } from 'express';
import { ObjectId } from 'mongodb';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

// 5. Toggle Add/Remove Favorite
export const toggleFavoriteController = async (req: AuthRequest, res: Response) => {
  try {
    const { equipmentId } = req.body;

    if (typeof equipmentId !== 'string' || !ObjectId.isValid(equipmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid equipment ID.' });
    }

    const userId = req.user?._id ? req.user._id.toString() : req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized user.' });
    }

    const db = getDB();
    const favoritesCollection = db.collection('favorites');
    const equipmentCollection = db.collection('equipment');

    const existing = await favoritesCollection.findOne({ userId, equipmentId });

    if (existing) {
      await favoritesCollection.deleteOne({ _id: existing._id });
      return res.status(200).json({
        success: true,
        isFavorite: false,
        message: 'Removed from favorites.',
      });
    }

    const equipment = await equipmentCollection.findOne({ _id: new ObjectId(equipmentId) });
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    await favoritesCollection.insertOne({
      userId,
      equipmentId,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      isFavorite: true,
      message: 'Added to favorites.',
    });
  } catch (error) {
    console.error('Error in toggleFavoriteController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 6. Check if Equipment is Favorited
export const checkFavoriteController = async (req: AuthRequest, res: Response) => {
  try {
    const { equipmentId } = req.params;
    const userId = req.user?._id ? req.user._id.toString() : req.user?.id;

    if (typeof equipmentId !== 'string' || !userId) {
      return res.status(200).json({ success: true, isFavorite: false });
    }

    const db = getDB();
    const existing = await db.collection('favorites').findOne({ userId, equipmentId });

    return res.status(200).json({
      success: true,
      isFavorite: Boolean(existing),
    });
  } catch (error) {
    console.error('Error in checkFavoriteController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 7. Get All Saved Favorite Equipment
export const getMyFavoritesController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();

    const favorites = await db
      .collection('favorites')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    const equipmentObjectIds = favorites
      .map((fav) => fav.equipmentId)
      .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const equipments = await db
      .collection('equipment')
      .find({ _id: { $in: equipmentObjectIds } })
      .toArray();

    return res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments,
    });
  } catch (error) {
    console.error('Error in getMyFavoritesController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};