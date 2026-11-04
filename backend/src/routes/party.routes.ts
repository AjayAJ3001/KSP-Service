import { Router } from 'express';
import { getParties, getPartyById, createParty, updateParty, updatePartyStatus, deleteParty } from '../controllers/master.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getParties);
router.get('/:id', getPartyById);
router.post('/', authorize('ADMIN', 'OWNER'), createParty);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateParty);
router.patch('/:id/status', authorize('ADMIN', 'OWNER'), updatePartyStatus);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteParty);

export default router;
