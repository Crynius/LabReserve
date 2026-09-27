import { pool } from '../config/db.js';

// Obtener todos los equipos con la información de su tipo
export const getEquipos = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id_equipo,
        e.nombre_equipo,
        e.marca,
        e.modelo,
        e.estado,
        e.numero_inventario,
        t.nombre AS tipo_equipo
      FROM equipos e
      INNER JOIN tipo_equipo t ON e.id_tipo_equipo = t.id_tipo_equipo
      WHERE e.activa = TRUE
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la lista de equipos' });
  }
};


// GET /api/equipos/total - Obtener el total de equipos para el Dashboard
export const getTotalEquipos = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM equipos WHERE activa = TRUE');
    res.json({ total: parseInt(rows[0].total) });
  } catch (error) {
    console.error('Error al obtener total de equipos:', error);
    res.status(500).json({ error: 'Error al consultar el total de equipos' });
  }
};