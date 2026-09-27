import { Router } from 'express';
import { 
  registrarEntrega, 
  registrarDevolucion, 
  registrarDevolucionPorEquipo,
  getEquiposActivos 
} from '../controllers/uso.controller.js';

const router = Router();

// GET /api/uso-equipos/activos - Obtener lista de equipos prestados actualmente
router.get('/activos', getEquiposActivos);

// POST /api/uso-equipos/entrega - Entregar equipos a un estudiante
router.post('/entrega', registrarEntrega);

// POST /api/uso-equipos/devolucion - Registrar devolución por id_uso
router.post('/devolucion', registrarDevolucion);

// POST /api/uso-equipos/devolucion-por-equipo - Registrar devolución por id_equipo
router.post('/devolucion-por-equipo', registrarDevolucionPorEquipo);

export default router;

