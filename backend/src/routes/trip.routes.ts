import { Router } from 'express';
import { getTrips, getTripById, createTrip, updateTripStatus, deleteTrip, deleteDraftTrip } from '../controllers/trip.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getTrips);
router.delete('/draft/:id', deleteDraftTrip);
router.get('/:id', getTripById);
router.post('/', createTrip);
router.patch('/:id/status', updateTripStatus);
router.delete('/:id', authorize('ADMIN'), deleteTrip);

export default router;
