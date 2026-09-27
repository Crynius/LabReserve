import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

// GET /api/equipos - Obtener todos los equipos
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM equipos');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la tabla equipos' });
  }
});

// GET /api/equipos/total - Obtener el total de equipos para los KPIs del Dashboard
router.get('/total', async (req, res) => {
  try {
    // Se elimina "WHERE activa = TRUE" para evitar el error de columna inexistente
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM equipos');
    res.json({ total: parseInt(rows[0].total) });
  } catch (error) {
    console.error('Error al obtener total de equipos:', error);
    res.status(500).json({ error: 'Error al consultar el total de equipos' });
  }
});

export default router;

