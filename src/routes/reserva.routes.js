import { Router } from 'express';
import { 
  getReservas, 
  createReserva, 
  getPendientes, 
  getColaEspera,
  cancelarReserva,
  devolverReserva // 1. Agregamos el controlador de devolución
} from '../controllers/reserva.controller.js';

const router = Router();

// GET /api/reservas - Listar todas las reservas (o filtradas por ?id_usuario=X)
router.get('/', getReservas);

// GET /api/reservas/pendientes - Listar solicitudes pendientes para el Dashboard
router.get('/pendientes', getPendientes);

// GET /api/reservas/cola - Listar la cola de espera activa
router.get('/cola', getColaEspera);

// POST /api/reservas - Crear una nueva reserva
router.post('/', createReserva);

// PUT /api/reservas/:id/cancelar - Cancelar una reserva
router.put('/:id/cancelar', cancelarReserva);

// PUT /api/reservas/:id/devolver - Solicitar devolución (Check-out) de un equipo
router.put('/:id/devolver', devolverReserva); // 2. Agregamos esta línea

export default router;