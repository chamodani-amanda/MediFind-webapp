import { Router, text } from 'express';
import { importInventory, importMedicines, importPharmacies, importSummary } from '../controllers/importController.js';
import { permit, protect } from '../middleware/auth.js';

const router = Router();
router.use(protect, permit('admin'));
router.get('/summary', importSummary);
router.post('/medicines', text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '5mb' }), importMedicines);
router.post('/pharmacies', text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '5mb' }), importPharmacies);
router.post('/inventory', text({ type: ['text/csv', 'application/csv', 'text/plain'], limit: '5mb' }), importInventory);
export default router;

