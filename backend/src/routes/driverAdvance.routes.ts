import { Router } from 'express';
import {
  getDriverAdvances,
  getDriverAdvancesSummary,
  getDriverAdvanceById,
  createDriverAdvance,
  updateDriverAdvance,
  deleteDriverAdvance,
} from '../controllers/driverAdvance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', getDriverAdvancesSummary);           // Driver ledger / summary
router.get('/', getDriverAdvances);                          // Get all driver advances with filters
router.get('/:id', getDriverAdvanceById);                    // Get single advance
router.post('/', createDriverAdvance);                       // Manager / Admin gives advance to driver
router.put('/:id', authorize('ADMIN'), updateDriverAdvance); // Admin update
router.delete('/:id', authorize('ADMIN'), deleteDriverAdvance); // Admin delete

export default router;
