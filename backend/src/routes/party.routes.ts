import { Router } from 'express';
import { getParties, getPartyById, createParty, updateParty, updatePartyStatus, deleteParty } from '../controllers/master.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getParties);
router.get('/:id', getPartyById);
router.post('/', authorize('ADMIN'), createParty);
router.put('/:id', authorize('ADMIN'), updateParty);
router.patch('/:id/status', authorize('ADMIN'), updatePartyStatus);
router.delete('/:id', authorize('ADMIN'), deleteParty);

export default router;
