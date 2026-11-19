import { Response } from 'express';
import { ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getDB } from '../config/db';

const getStripeClient = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is missing in server .env file.');
  }

  if (!secretKey.startsWith('sk_')) {
    throw new Error(
      'Invalid STRIPE_SECRET_KEY: Must be a Secret Key starting with sk_test_ or sk_live_.'
    );
  }

  return new Stripe(secretKey);
};

//  Create Stripe Checkout Session for a Booking
export const createCheckoutSessionController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const stripe = getStripeClient();
    const { bookingId } = req.body;

    if (typeof bookingId !== 'string' || !ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID.',
      });
    }

    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();
    const bookingsCollection = db.collection('bookings');

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking record not found.',
      });
    }

    if (booking.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only pay for your own bookings.',
      });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid.',
      });
    }

    if (
      booking.bookingStatus === 'cancelled' ||
      booking.bookingStatus === 'rejected'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pay for a cancelled or rejected booking.',
      });
    }

    const clientUrl = (
      process.env.CLIENT_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    const unitAmountInCents = Math.round(Number(booking.totalAmount) * 100);

    if (unitAmountInCents < 50) {
      return res.status(400).json({
        success: false,
        message: 'Minimum payable amount is $0.50.',
      });
    }

    // Stripe requires strictly valid public HTTPS URLs for product images
    const validImages =
      typeof booking.equipmentImage === 'string' &&
      booking.equipmentImage.startsWith('https://')
        ? [booking.equipmentImage]
        : [];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: booking.customerEmail || req.user?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: booking.equipmentName,
              description: `Rental (${booking.startDate} to ${booking.endDate}) • Qty: ${booking.requiredQuantity}`,
              ...(validImages.length > 0 ? { images: validImages } : {}),
            },
            unit_amount: unitAmountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        equipmentId: booking.equipmentId,
        customerId: customerId || '',
        ownerId: booking.ownerId || '',
      },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel?booking_id=${booking._id.toString()}`,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error in createCheckoutSessionController:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to create Stripe checkout session.';

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

//  Verify Stripe Session, Update Booking & Save Transaction in `payments` Collection
export const verifyPaymentSessionController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const stripe = getStripeClient();
    const { sessionId } = req.body;

    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Stripe session ID is required.',
      });
    }

    const db = getDB();
    const paymentsCollection = db.collection('payments');
    const bookingsCollection = db.collection('bookings');

    const existingPayment = await paymentsCollection.findOne({
      stripeSessionId: sessionId.trim(),
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified.',
        data: existingPayment,
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId.trim());

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been completed yet.',
      });
    }

    const bookingId = session.metadata?.bookingId;
    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking reference in payment session.',
      });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Associated booking not found.',
      });
    }

    const transactionId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

    const amountPaid = session.amount_total
      ? Number((session.amount_total / 100).toFixed(2))
      : Number(booking.totalAmount);

    const paidAt = new Date();

    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          paymentStatus: 'paid',
          transactionId,
          stripeSessionId: session.id,
          paidAt,
          updatedAt: paidAt,
        },
      }
    );

    const paymentRecord = {
      bookingId: booking._id.toString(),
      equipmentId: booking.equipmentId,
      equipmentName: booking.equipmentName,
      customerId: booking.customerId,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      ownerId: booking.ownerId,
      ownerName: booking.ownerName,
      amount: amountPaid,
      currency: (session.currency || 'usd').toUpperCase(),
      transactionId,
      stripeSessionId: session.id,
      status: 'succeeded',
      createdAt: paidAt,
    };

    const insertResult = await paymentsCollection.insertOne(paymentRecord);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and recorded successfully.',
      data: {
        ...paymentRecord,
        _id: insertResult.insertedId,
      },
    });
  } catch (error) {
    console.error('Error in verifyPaymentSessionController:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to verify Stripe payment session.';

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

// 3. Get Logged-in Customer's Payment Transactions
export const getMyPaymentsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const customerId = req.user?._id ? req.user._id.toString() : req.user?.id;
    const db = getDB();

    const payments = await db
      .collection('payments')
      .find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error('Error in getMyPaymentsController:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};