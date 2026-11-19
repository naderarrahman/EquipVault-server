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

// 5. Update / Edit Equipment (Owner Only - Own Equipment)
export const updateEquipmentController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid equipment ID format.',
      });
    }

    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const existingEquipment = await equipmentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found.',
      });
    }

    if (existingEquipment.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own equipment.',
      });
    }

    const {
      name,
      description,
      category,
      location,
      rentalPrice,
      rentalType,
      availableQuantity,
      condition,
      brand,
      model,
      image,
      terms,
    } = req.body;

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof name === 'string' && name.trim()) updateFields.name = name.trim();
    if (typeof description === 'string' && description.trim()) updateFields.description = description.trim();
    if (typeof category === 'string' && category.trim()) updateFields.category = category.trim();
    if (typeof location === 'string' && location.trim()) updateFields.location = location.trim();
    if (rentalPrice !== undefined && !Number.isNaN(Number(rentalPrice))) {
      updateFields.rentalPrice = Number(rentalPrice);
    }
    if (typeof rentalType === 'string' && rentalType.trim()) updateFields.rentalType = rentalType.trim();
    if (availableQuantity !== undefined && !Number.isNaN(Number(availableQuantity))) {
      updateFields.availableQuantity = Number(availableQuantity);
    }
    if (typeof condition === 'string' && condition.trim()) updateFields.condition = condition.trim();
    if (typeof brand === 'string' && brand.trim()) updateFields.brand = brand.trim();
    if (typeof model === 'string' && model.trim()) updateFields.model = model.trim();
    if (typeof image === 'string' && image.trim()) updateFields.image = image.trim();
    if (typeof terms === 'string' && terms.trim()) updateFields.terms = terms.trim();

    await equipmentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updatedEquipment = await equipmentCollection.findOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: 'Equipment updated successfully.',
      data: updatedEquipment,
    });
  } catch (error) {
    console.error('Error in updateEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 6. Delete Equipment (Owner Only - Own Equipment)
export const deleteEquipmentController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid equipment ID format.',
      });
    }

    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const existingEquipment = await equipmentCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found.',
      });
    }

    if (existingEquipment.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own equipment.',
      });
    }

    await equipmentCollection.deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: 'Equipment deleted successfully.',
    });
  } catch (error) {
    console.error('Error in deleteEquipmentController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};