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

router.get('/manager-summary', getManagerAdvancesSummary);          // manager advances overview
router.get('/', authorize('ADMIN'), getTruckAdvances);               // admin: all records
router.get('/mine', getMyTruckAdvances);                            // manager: own given advances
router.post('/', createTruckAdvance);                               // manager/admin can give truck advance
router.delete('/:id', authorize('ADMIN'), deleteTruckAdvance);      // admin only

export default router;
