import { Router } from 'express';
import { getDashboard, getMobileDashboard } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/admin', authorize('ADMIN'), getDashboard);
router.get('/mobile', getMobileDashboard);

export default router;
