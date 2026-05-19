import { Router } from 'express';
import { getUserCalls, initiateCall, deleteCall } from '../controllers/call.Controller';
import { protect } from '../middlewares/auth.middleware'; 

const router = Router();

router.use(protect);

router.get('/history', getUserCalls);
router.post('/initiate', initiateCall);
router.delete('/:id', deleteCall);

export default router;