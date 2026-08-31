import { Router } from 'express';
import { getAuditLogs } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/', getAuditLogs);

export default router;
