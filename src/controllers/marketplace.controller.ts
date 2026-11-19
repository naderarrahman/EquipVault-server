import { Request, Response } from 'express';
import { getDB } from '../config/db';

interface CategoryAggregationDoc {
  _id: string;
  count: number;
}

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