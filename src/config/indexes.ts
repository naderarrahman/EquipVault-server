import { getDB } from './db';

export const ensureDatabaseIndexes = async (): Promise<void> => {
  try {
    const db = getDB();

    await Promise.all([
      db.collection('equipment').createIndexes([
        { key: { status: 1, createdAt: -1 } },
        { key: { ownerId: 1, createdAt: -1 } },
        { key: { category: 1, status: 1 } },
      ]),
      db.collection('bookings').createIndexes([
        { key: { customerId: 1, createdAt: -1 } },
        { key: { ownerId: 1, createdAt: -1 } },
        { key: { equipmentId: 1, bookingStatus: 1 } },
      ]),
      db.collection('favorites').createIndexes([
        { key: { userId: 1, equipmentId: 1 }, unique: true },
      ]),
      db.collection('payments').createIndexes([
        { key: { customerId: 1, createdAt: -1 } },
        { key: { ownerId: 1, createdAt: -1 } },
        { key: { stripeSessionId: 1 }, unique: true },
      ]),
    ]);
  } catch (error) {
    console.error('Warning: Failed to create MongoDB indexes:', error);
  }
};