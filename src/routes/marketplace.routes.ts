import { Router } from 'express';
import {
  getHomePageData,
  getMarketplaceHighlightsController,
} from '../controllers/marketplace.controller';

const router = Router();

router.get('/highlights', getMarketplaceHighlightsController);
router.get('/home-data', getHomePageData);

export default router;