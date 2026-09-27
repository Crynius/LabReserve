import { Router } from 'express';
import { getUsuarios, createUsuario, loginUsuario } from '../controllers/usuario.controller.js';

const router = Router();

router.get('/', getUsuarios);
router.post('/', createUsuario);
router.post('/login', loginUsuario); // 👈 Esta es la única línea nueva

export default router;