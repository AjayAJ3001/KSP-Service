import { Router } from 'express';
import {
  getDriverAdvances,
  getDriverAdvancesSummary,
  getDriverAdvanceById,
  createDriverAdvance,
  updateDriverAdvance,
  deleteDriverAdvance,
  getDriverStatement,
} from '../controllers/driverAdvance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', getDriverAdvancesSummary);                    // Driver ledger / summary
router.get('/driver/:driverId/statement', getDriverStatement);      // Specific driver statement / ledger
router.get('/', getDriverAdvances);                                   // Get all driver advances with filters
router.get('/:id', getDriverAdvanceById);                             // Get single advance
router.post('/', createDriverAdvance);                       // Manager / Admin gives advance to driver
router.put('/:id', authorize('ADMIN', 'OWNER'), updateDriverAdvance); // Admin update
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteDriverAdvance); // Admin delete

export default router;
