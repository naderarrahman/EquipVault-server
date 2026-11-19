import { Router } from 'express';
import { getMarketplaceHighlightsController } from '../controllers/marketplace.controller';

const router = Router();

router.get('/highlights', getMarketplaceHighlightsController);

export default router;