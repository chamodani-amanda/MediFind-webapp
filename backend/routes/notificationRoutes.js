import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../controllers/notificationController.js';

const router = Router();
router.use(protect);
router.get('/', listNotifications);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
export default router;
