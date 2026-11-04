import { Router } from 'express';
import { getTripReport, getPaymentReport, getSettlementReport } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'OWNER'));

router.get('/trips', getTripReport);
router.get('/payments', getPaymentReport);
router.get('/settlements', getSettlementReport);

export default router;
