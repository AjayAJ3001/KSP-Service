import { Router } from 'express';
import {
  getTruckAdvances,
  getMyTruckAdvances,
  getManagerAdvancesSummary,
  createTruckAdvance,
  deleteTruckAdvance,
} from '../controllers/truckAdvance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/manager-summary', authorize('ADMIN', 'OWNER'), getManagerAdvancesSummary);
router.get('/', authorize('ADMIN', 'OWNER'), getTruckAdvances);               // admin: all records
router.get('/mine', getMyTruckAdvances);                            // manager: own given advances
router.post('/', createTruckAdvance);                               // manager/admin can give truck advance
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteTruckAdvance);      // admin only

export default router;
