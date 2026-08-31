import { Router } from 'express';
import { getTripPayments, addPayment, getPartyLedger, deletePayment } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/trip/:trip_id', getTripPayments);
router.post('/trip/:trip_id', addPayment);
router.get('/ledger/:party_id', getPartyLedger);
router.delete('/:id', authorize('ADMIN'), deletePayment);

export default router;
