import { Response } from 'express';
import { Filter, ObjectId, Document } from 'mongodb';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

//  Owner Dashboard Overview Analytics (with 6-Month Earnings Chart)
export const getOwnerOverviewController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized owner session.',
      });
    }

    const db = getDB();
    const [equipments, bookings, payments] = await Promise.all([
      db
        .collection('equipment')
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection('bookings')
        .find({ ownerId })
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection('payments')
        .find({ ownerId, status: 'succeeded' })
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    const approvedEquipment = equipments.filter(
      (e) => (e.status || '').toLowerCase() === 'approved'
    ).length;
    const pendingEquipment = equipments.filter(
      (e) => (e.status || 'pending').toLowerCase() === 'pending'
    ).length;
    const rejectedEquipment = equipments.filter(
      (e) => (e.status || '').toLowerCase() === 'rejected'
    ).length;
    const totalUnitsAvailable = equipments.reduce(
      (sum, e) => sum + Number(e.availableQuantity || 0),
      0
    );

    const pendingBookings = bookings.filter(
      (b) => b.bookingStatus === 'pending'
    ).length;
    const approvedBookings = bookings.filter(
      (b) => b.bookingStatus === 'approved'
    ).length;
    const completedBookings = bookings.filter(
      (b) => b.bookingStatus === 'completed'
    ).length;

    const paidEarnings = Number(
      payments
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
        .toFixed(2)
    );

    const pendingValue = Number(
      bookings
        .filter(
          (b) =>
            b.paymentStatus === 'unpaid' &&
            b.bookingStatus !== 'cancelled' &&
            b.bookingStatus !== 'rejected'
        )
        .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0)
        .toFixed(2)
    );

    // Build last 6 months earnings & bookings chart data
    const monthlyEarnings: Array<{
      month: string;
      earnings: number;
      bookings: number;
    }> = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = target.getFullYear();
      const monthIdx = target.getMonth();
      const label = target.toLocaleDateString('en-US', { month: 'short' });

      const monthEarned = payments
        .filter((p) => {
          if (!p.createdAt) return false;
          const d = new Date(p.createdAt as string | Date);
          return d.getFullYear() === year && d.getMonth() === monthIdx;
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const monthCount = bookings.filter((b) => {
        if (!b.createdAt) return false;
        const d = new Date(b.createdAt as string | Date);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
      }).length;

      monthlyEarnings.push({
        month: label,
        earnings: Number(monthEarned.toFixed(2)),
        bookings: monthCount,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        equipment: {
          total: equipments.length,
          approved: approvedEquipment,
          pending: pendingEquipment,
          rejected: rejectedEquipment,
          totalUnitsAvailable,
        },
        bookings: {
          total: bookings.length,
          pending: pendingBookings,
          approved: approvedBookings,
          completed: completedBookings,
        },
        revenue: {
          paidEarnings,
          pendingValue,
          transactionsCount: payments.length,
        },
        monthlyEarnings,
        recentBookings: bookings.slice(0, 5),
        recentEquipment: equipments.slice(0, 4),
      },
    });
  } catch (error) {
    console.error('Error in getOwnerOverviewController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load owner dashboard overview.',
    });
  }
};

//  Customer Dashboard Overview Analytics
export const getCustomerOverviewController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized customer session.',
      });
    }

    const db = getDB();
    const [bookings, favoritesCount, payments] = await Promise.all([
      db
        .collection('bookings')
        .find({ customerId })
        .sort({ createdAt: -1 })
        .toArray(),
      db.collection('favorites').countDocuments({ userId: customerId }),
      db
        .collection('payments')
        .find({ customerId, status: 'succeeded' })
        .sort({ createdAt: -1 })
        .toArray(),
    ]);

    const pendingBookings = bookings.filter(
      (b) => b.bookingStatus === 'pending'
    ).length;
    const activeRentals = bookings.filter(
      (b) => b.bookingStatus === 'approved'
    ).length;
    const completedRentals = bookings.filter(
      (b) => b.bookingStatus === 'completed'
    ).length;

    const totalPaid = Number(
      payments
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
        .toFixed(2)
    );

    const unpaidDue = Number(
      bookings
        .filter(
          (b) =>
            b.paymentStatus === 'unpaid' &&
            b.bookingStatus !== 'cancelled' &&
            b.bookingStatus !== 'rejected'
        )
        .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0)
        .toFixed(2)
    );

    return res.status(200).json({
      success: true,
      data: {
        bookings: {
          total: bookings.length,
          pending: pendingBookings,
          active: activeRentals,
          completed: completedRentals,
        },
        favoritesCount,
        spending: {
          totalPaid,
          unpaidDue,
          transactionsCount: payments.length,
        },
        recentBookings: bookings.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Error in getCustomerOverviewController:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load customer dashboard overview.',
    });
  }
};

//  Get Logged-in User Contact Info (Phone & Address)
export const getMyContactProfileController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id ? req.user._id.toString() : req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filter: Filter<Document> = ObjectId.isValid(userId)
      ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
      : { id: userId };

    const userDoc = await getDB().collection('user').findOne(filter);

    return res.status(200).json({
      success: true,
      data: {
        phone: typeof userDoc?.phone === 'string' ? userDoc.phone : '',
        address: typeof userDoc?.address === 'string' ? userDoc.address : '',
      },
    });
  } catch (error) {
    console.error('Error in getMyContactProfileController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to load contact profile.' });
  }
};

//  Update Logged-in User Contact Info (Phone & Address)
export const updateMyContactProfileController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?._id ? req.user._id.toString() : req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const phone =
      typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const address =
      typeof req.body.address === 'string' ? req.body.address.trim() : '';

    const filter: Filter<Document> = ObjectId.isValid(userId)
      ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
      : { id: userId };

    await getDB()
      .collection('user')
      .updateOne(filter, { $set: { phone, address, updatedAt: new Date() } });

    return res.status(200).json({
      success: true,
      message: 'Contact information updated.',
      data: { phone, address },
    });
  } catch (error) {
    console.error('Error in updateMyContactProfileController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to update contact info.' });
  }
};

