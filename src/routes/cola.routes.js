import { Router } from 'express';
import { unirseACola, cancelarCola } from '../controllers/cola.controller.js';

const router = Router();

// Ruta para unirse a la cola
router.post('/unirse', unirseACola);

// Ruta para cancelar la solicitud en la cola
router.patch('/cancelar/:id_cola', cancelarCola);

export default router;



