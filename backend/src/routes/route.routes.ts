import { Router } from 'express';
import { getRoutes, createRoute, updateRoute, deleteRoute } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getRoutes);
router.post('/', authorize('ADMIN'), createRoute);
router.put('/:id', authorize('ADMIN'), updateRoute);
router.delete('/:id', authorize('ADMIN'), deleteRoute);

export default router;
