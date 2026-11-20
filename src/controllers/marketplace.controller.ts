import { NextFunction, Request, Response } from 'express';
import { getDB } from '../config/db';

interface CategoryAggregationDoc {
  _id: string;
  count: number;
}

const STANDARD_CATEGORIES = [
  'Construction Equipment',
  'Photography Equipment',
  'Vehicles & Transportation',
  'Agriculture Equipment',
  'Electronics',
  'Event Equipment',
] as const;

export const getMarketplaceHighlightsController = async (
  _req: Request,
  res: Response
) => {
  try {
    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const [totalApproved, categorySummary, featuredEquipment, totalOwners] =
      await Promise.all([
        equipmentCollection.countDocuments({ status: 'approved' }),
        equipmentCollection
          .aggregate<CategoryAggregationDoc>([
            { $match: { status: 'approved' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .toArray(),
        equipmentCollection
          .find({ status: 'approved' })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray(),
        db.collection('user').countDocuments({ role: 'owner' }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        totalApprovedEquipment: totalApproved,
        totalVerifiedOwners: totalOwners,
        categories: categorySummary.map((item) => ({
          category: item._id,
          count: item.count,
        })),
        featuredEquipment,
      },
    });
  } catch (error) {
    console.error('Error in getMarketplaceHighlightsController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load marketplace highlights.',
    });
  }
};

export const getHomePageData = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const db = getDB();
    const equipmentCol = db.collection('equipment');
    const usersCol = db.collection('user');
    const bookingsCol = db.collection('bookings');

    const [
      featuredEquipment,
      categoryCountsRaw,
      approvedEquipmentCount,
      verifiedOwnersCount,
      totalBookingsCount,
    ] = await Promise.all([
      equipmentCol
        .find({ status: 'approved' })
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .toArray(),

      equipmentCol
        .aggregate<CategoryAggregationDoc>([
          { $match: { status: 'approved' } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ])
        .toArray(),

      equipmentCol.countDocuments({ status: 'approved' }),
      usersCol.countDocuments({ role: 'owner' }),
      bookingsCol.countDocuments({}),
    ]);

    const countMap = new Map<string, number>(
      categoryCountsRaw.map((entry) => [entry._id, entry.count])
    );

    const categories = STANDARD_CATEGORIES.map((name) => ({
      name,
      count: countMap.get(name) ?? 0,
    }));

    res.status(200).json({
      success: true,
      message: 'Home page data retrieved successfully.',
      data: {
        featuredEquipment,
        categories,
        stats: {
          approvedEquipmentCount,
          verifiedOwnersCount,
          totalBookingsCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};