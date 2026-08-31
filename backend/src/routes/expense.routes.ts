import { Router } from 'express';
import { getTripExpenses, addExpense, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/trip/:trip_id', getTripExpenses);
router.post('/trip/:trip_id', addExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
