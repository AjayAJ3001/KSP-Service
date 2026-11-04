import { Router } from 'express';
import {
  getUnloadingRates,
  getUnloadingRateById,
  createUnloadingRate,
  updateUnloadingRate,
  deleteUnloadingRate,
} from '../controllers/unloadingRate.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getUnloadingRates);
router.get('/:id', getUnloadingRateById);
router.post('/', authorize('ADMIN', 'OWNER'), createUnloadingRate);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateUnloadingRate);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteUnloadingRate);

export default router;
