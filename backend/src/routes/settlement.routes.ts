import { Router } from 'express';
import { getSettlements, getSettlementByTripId, generateSettlement, verifySettlement, deleteSettlement } from '../controllers/settlement.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getSettlements);
router.get('/trip/:trip_id', getSettlementByTripId);
router.post('/trip/:trip_id/generate', generateSettlement);
router.patch('/:id/verify', authorize('ADMIN'), verifySettlement);
router.delete('/:id', authorize('ADMIN'), deleteSettlement);

export default router;
