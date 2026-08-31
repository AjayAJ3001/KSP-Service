import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, updateUserStatus, resetPassword, deleteUser } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

export default router;
