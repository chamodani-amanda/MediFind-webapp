import { Router } from 'express';
import { login, logout, register } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';
const router = Router();
router.post('/register', requireFields('name', 'email', 'password'), register);
router.post('/login', requireFields('email', 'password'), login);
router.post('/logout', protect, logout);
export default router;
