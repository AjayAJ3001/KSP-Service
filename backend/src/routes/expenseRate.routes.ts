import { Router } from 'express';
import { getExpenseRates, createExpenseRate, updateExpenseRate, deleteExpenseRate } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getExpenseRates);
router.post('/', authorize('ADMIN', 'OWNER'), createExpenseRate);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateExpenseRate);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteExpenseRate);

export default router;
