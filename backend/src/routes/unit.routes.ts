import { Router } from 'express';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getUnits);
router.post('/', authorize('ADMIN', 'OWNER'), createUnit);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateUnit);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteUnit);

export default router;
