import { Router } from 'express';
import { getFreightRates, createFreightRate, updateFreightRate, deleteFreightRate } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getFreightRates);
router.post('/', authorize('ADMIN', 'OWNER'), createFreightRate);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateFreightRate);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteFreightRate);

export default router;
