import { Request, Response } from 'express';
import { ObjectId, Sort } from 'mongodb';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. Create Equipment (Owner)
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

// 2. Get Logged-in Owner's Equipment (Owner)
export const getMyEquipmentController = async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;

    const equipments = await equipmentCollection
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments,
    });
  } catch (error) {
    console.error('Error in getMyEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 3. Get All Equipment with Search, Filter & Sort (Public)
export const getAllEquipmentController = async (req: Request, res: Response) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const {
      search,
      category,
      rentalType,
      minPrice,
      maxPrice,
      availability,
      sort,
      status,
    } = req.query;

    const query: Record<string, unknown> = {};

    if (status === 'all') {
      // Admin can pass ?status=all
    } else if (typeof status === 'string' && status.trim()) {
      query.status = status.trim().toLowerCase();
    } else {
      query.status = 'approved';
    }

    if (typeof search === 'string' && search.trim()) {
      const safeKeyword = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { location: { $regex: safeKeyword, $options: 'i' } },
      ];
    }

    if (typeof category === 'string' && category.trim() && category !== 'All') {
      query.category = category.trim();
    }

    if (typeof rentalType === 'string' && rentalType.trim() && rentalType !== 'All') {
      query.rentalType = {
        $regex: `^${escapeRegex(rentalType.trim())}$`,
        $options: 'i',
      };
    }

    const priceFilter: Record<string, number> = {};
    if (typeof minPrice === 'string' && minPrice.trim() !== '') {
      const parsedMin = Number(minPrice);
      if (!Number.isNaN(parsedMin) && parsedMin >= 0) {
        priceFilter.$gte = parsedMin;
      }
    }
    if (typeof maxPrice === 'string' && maxPrice.trim() !== '') {
      const parsedMax = Number(maxPrice);
      if (!Number.isNaN(parsedMax) && parsedMax >= 0) {
        priceFilter.$lte = parsedMax;
      }
    }
    if (Object.keys(priceFilter).length > 0) {
      query.rentalPrice = priceFilter;
    }

    if (typeof availability === 'string' && availability.trim() && availability !== 'all') {
      const normalizedAvailability = availability.trim().toLowerCase();
      if (normalizedAvailability === 'available' || normalizedAvailability === 'true') {
        query.availableQuantity = { $gt: 0 };
      } else if (
        normalizedAvailability === 'unavailable' ||
        normalizedAvailability === 'false'
      ) {
        query.availableQuantity = { $lte: 0 };
      }
    }

    let sortOption: Sort = { createdAt: -1 };
    if (typeof sort === 'string') {
      switch (sort.trim().toLowerCase()) {
        case 'price-asc':
        case 'low-to-high':
          sortOption = { rentalPrice: 1, createdAt: -1 };
          break;
        case 'price-desc':
        case 'high-to-low':
          sortOption = { rentalPrice: -1, createdAt: -1 };
          break;
        case 'recent':
        case 'newest':
        default:
          sortOption = { createdAt: -1 };
          break;
      }
    }

    const equipments = await equipmentCollection
      .find(query)
      .sort(sortOption)
      .toArray();

    return res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments,
    });
  } catch (error) {
    console.error('Error in getAllEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 4. Get Single Equipment Details (Private - Logged-in Users)
export const getSingleEquipmentController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid equipment ID format.',
      });
    }

    const db = getDB();
    const equipment = await db.collection('equipment').findOne({
      _id: new ObjectId(id),
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error('Error in getSingleEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};