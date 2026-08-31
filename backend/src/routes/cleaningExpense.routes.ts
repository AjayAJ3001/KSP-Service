import { Router } from 'express';
import {
  getCleaningExpenseRates,
  getCleaningExpenseRateById,
  createCleaningExpenseRate,
  updateCleaningExpenseRate,
  deleteCleaningExpenseRate,
} from '../controllers/cleaningExpense.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getCleaningExpenseRates);
router.get('/:id', getCleaningExpenseRateById);
router.post('/', authorize('ADMIN'), createCleaningExpenseRate);
router.put('/:id', authorize('ADMIN'), updateCleaningExpenseRate);
router.delete('/:id', authorize('ADMIN'), deleteCleaningExpenseRate);

export default router;
