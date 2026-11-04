import { Router } from 'express';
import { getVehicles, getVehicleById, getExpiringVehicles, createVehicle, updateVehicle, updateVehicleStatus, deleteVehicle } from '../controllers/master.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getVehicles);
router.get('/expiring', getExpiringVehicles);
router.get('/:id', getVehicleById);
router.post('/', authorize('ADMIN', 'OWNER'), createVehicle);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateVehicle);
router.patch('/:id/status', authorize('ADMIN', 'OWNER'), updateVehicleStatus);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteVehicle);

export default router;
