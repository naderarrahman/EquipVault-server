import { Response } from 'express';
import { ObjectId } from 'mongodb';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

// 1. Customer: Create a new booking request
export const createBookingController = async (req: AuthRequest, res: Response) => {
  try {
    const {
      equipmentId,
      startDate,
      endDate,
      requiredQuantity,
      contactNumber,
      deliveryAddress,
      additionalNotes,
    } = req.body;

    if (typeof equipmentId !== 'string' || !ObjectId.isValid(equipmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid equipment ID.' });
    }

    const quantity = Number(requiredQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Required quantity must be at least 1.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Rental end date must be after start date.',
      });
    }

    if (typeof contactNumber !== 'string' || !contactNumber.trim() || typeof deliveryAddress !== 'string' || !deliveryAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Contact number and delivery address are required.',
      });
    }

    const db = getDB();
    const equipmentCollection = db.collection('equipment');
    const bookingsCollection = db.collection('bookings');

    const equipment = await equipmentCollection.findOne({ _id: new ObjectId(equipmentId) });
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    if (equipment.availableQuantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${equipment.availableQuantity} unit(s) available right now.`,
      });
    }

    const diffMs = end.getTime() - start.getTime();
    const durationDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let billingUnits = durationDays;
    if (equipment.rentalType === 'Weekly') {
      billingUnits = Math.ceil(durationDays / 7);
    } else if (equipment.rentalType === 'Monthly') {
      billingUnits = Math.ceil(durationDays / 30);
    }

    const totalAmount = Number((billingUnits * Number(equipment.rentalPrice) * quantity).toFixed(2));
    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;

    const newBooking = {
      equipmentId: equipment._id.toString(),
      equipmentName: equipment.name,
      equipmentImage: equipment.image,
      rentalType: equipment.rentalType,
      unitPrice: Number(equipment.rentalPrice),
      ownerId: equipment.ownerId,
      ownerName: equipment.ownerName || '',
      ownerEmail: equipment.ownerEmail || '',
      customerId,
      customerName: req.user?.name || '',
      customerEmail: req.user?.email || '',
      startDate,
      endDate,
      durationDays,
      billingUnits,
      requiredQuantity: quantity,
      totalAmount,
      contactNumber: contactNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      additionalNotes: typeof additionalNotes === 'string' ? additionalNotes.trim() : '',
      bookingStatus: 'pending',
      paymentStatus: 'unpaid',
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully.',
      bookingId: result.insertedId,
      data: {
        ...newBooking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error('Error in createBookingController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 2. Customer: Get logged-in customer's own bookings
export const getMyBookingsController = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();

    const bookings = await db
      .collection('bookings')
      .find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Error in getMyBookingsController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 3. Customer: Cancel own pending booking
export const cancelMyBookingController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID.' });
    }

    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.customerId !== customerId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Not your booking.' });
    }

    if (booking.bookingStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be cancelled.',
      });
    }

    await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingStatus: 'cancelled', updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
    });
  } catch (error) {
    console.error('Error in cancelMyBookingController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 4. Owner: Get all rental requests for logged-in owner's equipment
export const getOwnerBookingsController = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();

    const bookings = await db
      .collection('bookings')
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Error in getOwnerBookingsController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 5. Owner: Approve, Reject, or Complete a rental request (auto-updates stock)
export const updateBookingStatusController = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID.' });
    }

    const allowedStatuses = ['approved', 'rejected', 'completed'];
    if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved, rejected, or completed.',
      });
    }

    const ownerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();
    const bookingsCollection = db.collection('bookings');
    const equipmentCollection = db.collection('equipment');

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.ownerId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only manage bookings for your own equipment.',
      });
    }

    // Handle stock adjustment on approve / complete
    if (status === 'approved' && booking.bookingStatus === 'pending') {
      const equipment = await equipmentCollection.findOne({
        _id: new ObjectId(booking.equipmentId),
      });

      if (!equipment || equipment.availableQuantity < booking.requiredQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient equipment stock to approve this request.',
        });
      }

      await equipmentCollection.updateOne(
        { _id: new ObjectId(booking.equipmentId) },
        { $inc: { availableQuantity: -Number(booking.requiredQuantity) } }
      );
    } else if (status === 'completed' && booking.bookingStatus === 'approved') {
      await equipmentCollection.updateOne(
        { _id: new ObjectId(booking.equipmentId) },
        { $inc: { availableQuantity: Number(booking.requiredQuantity) } }
      );
    }

    await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingStatus: status, updatedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: `Booking marked as ${status}.`,
    });
  } catch (error) {
    console.error('Error in updateBookingStatusController:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};