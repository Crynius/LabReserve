import { Router } from 'express';
import { getEquipos, getTotalEquipos } from '../controllers/product.controller.js';

const router = Router();

router.get('/', getEquipos);
router.get('/total', getTotalEquipos); // <-- Nueva ruta

export default router;