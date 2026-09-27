import { Router } from 'express';
import { pool } from '../config/db.js';
import equipoRoutes from './equipos.routes.js';
import usuarioRoutes from './usuario.routes.js';
import reservaRoutes from './reserva.routes.js';
import usoRoutes from './uso.routes.js';
import colaRoutes from './cola.routes.js'; // 1. Agregas esta importación

const router = Router();

// Ruta de prueba
router.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      message: 'Conexión a BD activa',
      serverTime: result.rows[0].now
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

// Enrutadores
router.use('/equipos', equipoRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/reservas', reservaRoutes);
router.use('/uso-equipos', usoRoutes);
router.use('/cola-espera', colaRoutes); // 2. Agregas este enrutador

export default router;