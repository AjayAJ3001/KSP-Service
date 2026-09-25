import { Router } from 'express';
import {
  getOtherExpenseLimits,
  getEffectiveOtherExpenseLimit,
  createOtherExpenseLimit,
  updateOtherExpenseLimit,
  deleteOtherExpenseLimit,
} from '../controllers/otherExpenseLimit.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Publicly accessible for authenticated users (both admin and mobile drivers)
router.get('/', getOtherExpenseLimits);
router.get('/effective', getEffectiveOtherExpenseLimit);

// Admin-only management routes
router.post('/', authorize('ADMIN'), createOtherExpenseLimit);
router.put('/:id', authorize('ADMIN'), updateOtherExpenseLimit);
router.delete('/:id', authorize('ADMIN'), deleteOtherExpenseLimit);

export default router;
