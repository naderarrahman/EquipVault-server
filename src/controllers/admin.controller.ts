import { Response } from 'express';
import { Filter, ObjectId, Document } from 'mongodb';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

const buildUserFilter = (id: string): Filter<Document> => {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { id }] };
  }
  return { id };
};

//  Admin Dashboard Overview Stats
export const getAdminStatsController = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const db = getDB();
    const userCollection = db.collection('user');
    const equipmentCollection = db.collection('equipment');
    const bookingsCollection = db.collection('bookings');
    const paymentsCollection = db.collection('payments');

    const [
      totalUsers,
      totalOwners,
      totalCustomers,
      totalEquipment,
      pendingEquipment,
      approvedEquipment,
      totalBookings,
      activeBookings,
      payments,
    ] = await Promise.all([
      userCollection.countDocuments(),
      userCollection.countDocuments({ role: 'owner' }),
      userCollection.countDocuments({ role: 'customer' }),
      equipmentCollection.countDocuments(),
      equipmentCollection.countDocuments({ status: 'pending' }),
      equipmentCollection.countDocuments({ status: 'approved' }),
      bookingsCollection.countDocuments(),
      bookingsCollection.countDocuments({ bookingStatus: 'approved' }),
      paymentsCollection.find({ status: 'succeeded' }).toArray(),
    ]);

    const totalRevenue = Number(
      payments
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        .toFixed(2)
    );

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          owners: totalOwners,
          customers: totalCustomers,
        },
        equipment: {
          total: totalEquipment,
          pending: pendingEquipment,
          approved: approvedEquipment,
        },
        bookings: {
          total: totalBookings,
          active: activeBookings,
        },
        revenue: {
          total: totalRevenue,
          transactionsCount: payments.length,
        },
      },
    });
  } catch (error) {
    console.error('Error in getAdminStatsController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

//  Get All Registered Users
export const getAllUsersController = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const db = getDB();
    const users = await db
      .collection('user')
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Error in getAllUsersController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

//  Update User Role (customer | owner | admin)
export const updateUserRoleController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (typeof id !== 'string' || !id.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid user ID.' });
    }

    const allowedRoles = ['customer', 'owner', 'admin'];
    if (typeof role !== 'string' || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be customer, owner, or admin.',
      });
    }

    const currentAdminId = req.user?._id
      ? req.user._id.toString()
      : req.user?.id;

    if (currentAdminId === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own admin role.',
      });
    }

    const db = getDB();
    const userCollection = db.collection('user');
    const filter = buildUserFilter(id);

    const existingUser = await userCollection.findOne(filter);
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found.' });
    }

    await userCollection.updateOne(filter, {
      $set: { role, updatedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}.`,
    });
  } catch (error) {
    console.error('Error in updateUserRoleController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

//  Delete User Account
export const deleteUserController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (typeof id !== 'string' || !id.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid user ID.' });
    }

    const currentAdminId = req.user?._id
      ? req.user._id.toString()
      : req.user?.id;

    if (currentAdminId === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account.',
      });
    }

    const db = getDB();
    const userCollection = db.collection('user');
    const filter = buildUserFilter(id);

    const existingUser = await userCollection.findOne(filter);
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found.' });
    }

    await userCollection.deleteOne(filter);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
    });
  } catch (error) {
    console.error('Error in deleteUserController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

//  Get All Equipment for Moderation (Pending, Approved, Rejected)
export const getAllEquipmentAdminController = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const db = getDB();
    const equipments = await db
      .collection('equipment')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: equipments.length,
      data: equipments,
    });
  } catch (error) {
    console.error('Error in getAllEquipmentAdminController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

//  Approve or Reject Equipment Listing
export const updateEquipmentStatusAdminController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid equipment ID.' });
    }

    const allowedStatuses = ['approved', 'rejected', 'pending'];
    if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved, rejected, or pending.',
      });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');

    const existing = await equipmentCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Equipment not found.' });
    }

    await equipmentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: `Equipment listing marked as ${status}.`,
    });
  } catch (error) {
    console.error('Error in updateEquipmentStatusAdminController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

// Get All Platform Bookings
export const getAllBookingsAdminController = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const db = getDB();
    const bookings = await db
      .collection('bookings')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Error in getAllBookingsAdminController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

// Get All Platform Stripe Payment Transactions
export const getAllPaymentsAdminController = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const db = getDB();
    const payments = await db
      .collection('payments')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error('Error in getAllPaymentsAdminController:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};