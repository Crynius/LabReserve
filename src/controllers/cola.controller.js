import { pool } from '../config/db.js';

// POST /api/cola-espera/unirse
export const unirseACola = async (req, res) => {
  const { id_detalle_reserva } = req.body;

  if (!id_detalle_reserva) {
    return res.status(400).json({ error: 'El id_detalle_reserva es obligatorio' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener la última posición para este detalle específico de equipo
    const posRes = await client.query(
      `SELECT COALESCE(MAX(posicion), 0) + 1 AS siguiente_posicion 
       FROM cola_espera 
       WHERE id_detalle_reserva = $1 AND estado = 'EN_ESPERA'`,
      [id_detalle_reserva]
    );
    const siguientePosicion = posRes.rows[0].siguiente_posicion;

    // 2. Insertar en cola_espera
    const insertQuery = `
      INSERT INTO cola_espera (id_detalle_reserva, posicion, estado)
      VALUES ($1, $2, 'EN_ESPERA')
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [id_detalle_reserva, siguientePosicion]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: `Añadido a la cola de espera en la posición #${siguientePosicion}`,
      cola: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al unirse a la cola:', error);
    res.status(500).json({ error: 'Error al procesar la cola de espera', detalle: error.message });
  } finally {
    client.release();
  }
};

// PATCH /api/cola-espera/cancelar/:id_cola
export const cancelarCola = async (req, res) => {
  const { id_cola } = req.params;

  if (!id_cola) {
    return res.status(400).json({ error: 'El id_cola es obligatorio' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener información de la reserva en cola
    const registroRes = await client.query(
      `SELECT id_detalle_reserva, posicion, estado 
       FROM cola_espera 
       WHERE id_cola = $1`,
      [id_cola]
    );

    if (registroRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registro no encontrado en la cola' });
    }

    const { id_detalle_reserva, posicion, estado } = registroRes.rows[0];

    // Solo se permite cancelar si aún está en espera
    if (estado !== 'EN_ESPERA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `No se puede cancelar una cola que está en estado ${estado}` 
      });
    }

    // 2. Cambiar el estado a CANCELADO
    await client.query(
      `UPDATE cola_espera 
       SET estado = 'CANCELADO' 
       WHERE id_cola = $1`,
      [id_cola]
    );

    // 3. Restar 1 a las posiciones de los usuarios que estaban detrás
    await client.query(
      `UPDATE cola_espera 
       SET posicion = posicion - 1 
       WHERE id_detalle_reserva = $1 
         AND estado = 'EN_ESPERA' 
         AND posicion > $2`,
      [id_detalle_reserva, posicion]
    );

    await client.query('COMMIT');

    res.json({ mensaje: 'Cancelado de la cola exitosamente y posiciones reordenadas' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar la cola:', error);
    res.status(500).json({ error: 'Error al cancelar la cola de espera', detalle: error.message });
  } finally {
    client.release();
  }
};