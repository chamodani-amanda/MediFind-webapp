import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
const router = Router();
router.use(protect);
router.route('/profile').get(getProfile).put(updateProfile);
export default router;
