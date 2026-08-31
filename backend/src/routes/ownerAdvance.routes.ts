import { Router } from 'express';
import {
  getOwnerAdvances,
  getOwnerAdvanceById,
  createOwnerAdvance,
  updateOwnerAdvance,
  deleteOwnerAdvance,
} from '../controllers/ownerAdvance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getOwnerAdvances);
router.get('/:id', getOwnerAdvanceById);
router.post('/', authorize('ADMIN'), createOwnerAdvance);
router.put('/:id', authorize('ADMIN'), updateOwnerAdvance);
router.delete('/:id', authorize('ADMIN'), deleteOwnerAdvance);

export default router;
