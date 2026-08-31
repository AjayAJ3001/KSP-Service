import { Router } from 'express';
import { getOwners, getOwnerById, createOwner, updateOwner, deleteOwner } from '../controllers/owner.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getOwners);
router.get('/:id', getOwnerById);
router.post('/', authorize('ADMIN'), createOwner);
router.put('/:id', authorize('ADMIN'), updateOwner);
router.delete('/:id', authorize('ADMIN'), deleteOwner);

export default router;
