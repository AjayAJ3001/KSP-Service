import { Router } from 'express';
import { getVehicles, getVehicleById, createVehicle, updateVehicle, updateVehicleStatus, deleteVehicle } from '../controllers/master.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.post('/', authorize('ADMIN'), createVehicle);
router.put('/:id', authorize('ADMIN'), updateVehicle);
router.patch('/:id/status', authorize('ADMIN'), updateVehicleStatus);
router.delete('/:id', authorize('ADMIN'), deleteVehicle);

export default router;
