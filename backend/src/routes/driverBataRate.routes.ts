import { Router } from 'express';
import {
  getDriverBataRates,
  getEffectiveBataRate,
  createDriverBataRate,
  updateDriverBataRate,
  deleteDriverBataRate,
} from '../controllers/driverBataRate.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Publicly accessible for authenticated users (both admin and mobile drivers)
router.get('/', getDriverBataRates);
router.get('/effective', getEffectiveBataRate);

// Admin-only management routes
router.post('/', authorize('ADMIN'), createDriverBataRate);
router.put('/:id', authorize('ADMIN'), updateDriverBataRate);
router.delete('/:id', authorize('ADMIN'), deleteDriverBataRate);

export default router;
