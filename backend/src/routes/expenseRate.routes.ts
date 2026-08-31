import { Router } from 'express';
import { getExpenseRates, createExpenseRate, updateExpenseRate, deleteExpenseRate } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getExpenseRates);
router.post('/', authorize('ADMIN'), createExpenseRate);
router.put('/:id', authorize('ADMIN'), updateExpenseRate);
router.delete('/:id', authorize('ADMIN'), deleteExpenseRate);

export default router;
