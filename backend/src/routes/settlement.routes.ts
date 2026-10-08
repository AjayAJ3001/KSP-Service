import { Router } from 'express';
import {
  getSettlements,
  getSettlementById,
  getSettlementByTripId,
  generateSettlement,
  verifySettlement,
  settlePayment,
  getSettlementPayments,
  deleteSettlementPayment,
  deleteSettlement,
} from '../controllers/settlement.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getSettlements);
router.get('/:id', getSettlementById);
router.get('/trip/:trip_id', getSettlementByTripId);
router.post('/trip/:trip_id/generate', generateSettlement);
router.patch('/:id/verify', authorize('ADMIN'), verifySettlement);
router.post('/:id/settle', authorize('ADMIN', 'TRANSPORT_USER'), settlePayment);
router.get('/:id/payments', getSettlementPayments);
router.delete('/payments/:paymentId', authorize('ADMIN'), deleteSettlementPayment);
router.delete('/:id', authorize('ADMIN'), deleteSettlement);

export default router;
