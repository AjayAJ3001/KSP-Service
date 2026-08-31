import { Router } from 'express';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getUnits);
router.post('/', authorize('ADMIN'), createUnit);
router.put('/:id', authorize('ADMIN'), updateUnit);
router.delete('/:id', authorize('ADMIN'), deleteUnit);

export default router;
