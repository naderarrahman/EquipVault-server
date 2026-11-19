import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  toggleFavoriteController,
  checkFavoriteController,
  getMyFavoritesController,
} from '../controllers/favorite.controller';

const router = Router();

router.post('/toggle', verifyToken, toggleFavoriteController);
router.get('/my-favorites', verifyToken, getMyFavoritesController);
router.get('/check/:equipmentId', verifyToken, checkFavoriteController);

export default router;