import { Router } from 'express';
import { getDrivers, getDriverById, getExpiringDrivers, createDriver, updateDriver, updateDriverStatus, deleteDriver } from '../controllers/master.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getDrivers);
router.get('/expiring', getExpiringDrivers);
router.get('/:id', getDriverById);
router.post('/', authorize('ADMIN', 'OWNER'), createDriver);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateDriver);
router.patch('/:id/status', authorize('ADMIN', 'OWNER'), updateDriverStatus);
router.delete('/:id', authorize('ADMIN', 'OWNER'), deleteDriver);

export default router;
