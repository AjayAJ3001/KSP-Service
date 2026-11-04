import { Router } from 'express';
import {
  getSettlements,
  getSettlementById,
  getSettlementByTripId,
  generateSettlement,
  verifySettlement,
  settlePayment,
  settleDriverBalance,
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
router.patch('/:id/verify', authorize('ADMIN', 'OWNER'), verifySettlement);
router.post('/driver/:driverId/settle', authorize('ADMIN', 'OWNER', 'TRANSPORT_USER'), settleDriverBalance);
router.post('/:id/settle', authorize('ADMIN', 'OWNER', 'TRANSPORT_USER'), settlePayment);
router.get('/:id/payments', getSettlementPayments);
router.delete('/payments/:paymentId', authorize('ADMIN', 'OWNER'), deleteSettlementPayment);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteSettlement);

export default router;
