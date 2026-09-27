import { pool } from '../config/db.js';

// GET /api/reservas - Listar reservas (Filtrado por id_usuario si se recibe por Query Param)
export const getReservas = async (req, res) => {
  const { id_usuario } = req.query; // Captura el parámetro ?id_usuario=X si viene en la URL

  try {
    let query = `
      SELECT 
        r.id_reserva,
        r.id_usuario,
        u.nombre || ' ' || u.apellido AS usuario,
        l.nombre AS laboratorio,
        r.hora_inicio,
        r.hora_fin,
        r.estado,
        r.fecha_creacion,
        STRING_AGG(e.nombre_equipo, ', ') AS nombre_equipo
      FROM reservas r
      JOIN usuarios u ON r.id_usuario = u.id_usuario
      JOIN laboratorios l ON r.id_laboratorio = l.id_laboratorio
      LEFT JOIN detalle_reserva dr ON r.id_reserva = dr.id_reserva
      LEFT JOIN equipos e ON dr.id_equipo = e.id_equipo
    `;

    const values = [];

    // Si la petición incluye id_usuario, se filtran únicamente sus registros
    if (id_usuario) {
      query += ` WHERE r.id_usuario = $1 `;
      values.push(id_usuario);
    }

    query += ` 
      GROUP BY r.id_reserva, r.id_usuario, u.nombre, u.apellido, l.nombre, r.hora_inicio, r.hora_fin, r.estado, r.fecha_creacion
      ORDER BY r.fecha_creacion DESC 
    `;

    const { rows } = await pool.query(query, values);
    res.json(rows);

  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({ error: 'Error al obtener las reservas' });
  }
};

// POST /api/reservas - Crear reserva con sus equipos o enviar a cola de espera si hay traslape
export const createReserva = async (req, res) => {
  const { id_usuario, id_laboratorio, hora_inicio, hora_fin, equipos } = req.body;

  if (
    !id_usuario ||
    !id_laboratorio ||
    !hora_inicio ||
    !hora_fin ||
    !equipos ||
    !Array.isArray(equipos) ||
    equipos.length === 0
  ) {
    return res.status(400).json({
      error: 'Todos los campos y al menos un equipo son requeridos'
    });
  }

  const inicio = new Date(hora_inicio);
  const fin = new Date(hora_fin);

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return res.status(400).json({ error: 'La fecha u hora proporcionada no es válida' });
  }

  if (fin <= inicio) {
    return res.status(400).json({ error: 'La hora de fin debe ser mayor que la hora de inicio' });
  }

  const diferenciaHoras = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  if (diferenciaHoras > 2) {
    return res.status(400).json({
      error: 'El tiempo máximo de reserva es de 2 horas',
      duracion_solicitada: `${diferenciaHoras} horas`,
      duracion_maxima: '2 horas'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const conflictoQuery = `
      SELECT dr.id_equipo, e.nombre_equipo
      FROM detalle_reserva dr
      JOIN reservas r ON dr.id_reserva = r.id_reserva
      JOIN equipos e ON dr.id_equipo = e.id_equipo
      WHERE dr.id_equipo = ANY($1::int[])
        AND r.estado IN ('PENDIENTE', 'EN_CURSO')
        AND ($2 < r.hora_fin AND $3 > r.hora_inicio)
    `;

    const conflictoRes = await client.query(conflictoQuery, [equipos, inicio, fin]);
    const hayConflicto = conflictoRes.rows.length > 0;

    const estadoReserva = hayConflicto ? 'EN_COLA' : 'PENDIENTE';
    const estadoDetalle = hayConflicto ? 'EN_COLA' : 'SOLICITADO';

    const insertReservaQuery = `
      INSERT INTO reservas (id_usuario, id_laboratorio, hora_inicio, hora_fin, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_reserva, id_usuario, id_laboratorio, hora_inicio, hora_fin, estado;
    `;

    const reservaResult = await client.query(insertReservaQuery, [
      id_usuario,
      id_laboratorio,
      hora_inicio,
      hora_fin,
      estadoReserva
    ]);

    const nuevaReserva = reservaResult.rows[0];

    const insertDetalleQuery = `
      INSERT INTO detalle_reserva (id_reserva, id_equipo, estado)
      VALUES ($1, $2, $3)
      RETURNING id_detalle_reserva, id_equipo, estado;
    `;

    const detalles = [];
    const registrosCola = [];

    for (const id_equipo of equipos) {
      const detalleResult = await client.query(insertDetalleQuery, [
        nuevaReserva.id_reserva,
        id_equipo,
        estadoDetalle
      ]);

      const nuevoDetalle = detalleResult.rows[0];
      detalles.push(nuevoDetalle);

      if (hayConflicto) {
        const posQuery = `
          SELECT COALESCE(MAX(ce.posicion), 0) + 1 AS siguiente_posicion
          FROM cola_espera ce
          JOIN detalle_reserva dr ON ce.id_detalle_reserva = dr.id_detalle_reserva
          WHERE dr.id_equipo = $1 AND ce.estado = 'PENDIENTE'
        `;
        const posResult = await client.query(posQuery, [id_equipo]);
        const siguientePosicion = parseInt(posResult.rows[0].siguiente_posicion);

        const insertColaQuery = `
          INSERT INTO cola_espera (id_detalle_reserva, posicion, estado)
          VALUES ($1, $2, 'PENDIENTE')
          RETURNING id_cola, id_detalle_reserva, posicion, estado, fecha_solicitud;
        `;
        const colaResult = await client.query(insertColaQuery, [
          nuevoDetalle.id_detalle_reserva,
          siguientePosicion
        ]);

        registrosCola.push(colaResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    if (hayConflicto) {
      return res.status(201).json({
        mensaje: 'Los equipos solicitados están ocupados en este horario. La solicitud ha sido registrada en la cola de espera.',
        reserva: nuevaReserva,
        equipos_reservados: detalles,
        cola_espera: registrosCola
      });
    }

    return res.status(201).json({
      mensaje: 'Reserva creada exitosamente',
      reserva: nuevaReserva,
      equipos_reservados: detalles
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear reserva:', error);

    if (error.code === '23503') {
      return res.status(400).json({
        error: 'El usuario, laboratorio o uno de los equipos especificados no existe en la base de datos'
      });
    }

    res.status(500).json({ error: 'Error al procesar la reserva' });

  } finally {
    client.release();
  }
};

// GET /api/reservas/pendientes - Solo solicitudes listas para entrega
export const getPendientes = async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id_reserva,
        u.nombre || ' ' || u.apellido AS usuario_nombre,
        l.nombre AS laboratorio,
        r.hora_inicio,
        r.hora_fin,
        UPPER(r.estado) AS estado,
        STRING_AGG(e.nombre_equipo, ', ') AS equipos
      FROM reservas r
      JOIN usuarios u ON r.id_usuario = u.id_usuario
      JOIN laboratorios l ON r.id_laboratorio = l.id_laboratorio
      JOIN detalle_reserva dr ON r.id_reserva = dr.id_reserva
      JOIN equipos e ON dr.id_equipo = e.id_equipo
      WHERE UPPER(r.estado) = 'PENDIENTE'
      GROUP BY r.id_reserva, u.nombre, u.apellido, l.nombre, r.hora_inicio, r.hora_fin, r.estado
      ORDER BY r.hora_inicio ASC;
    `;

    const { rows } = await pool.query(query);
    res.json(rows);

  } catch (error) {
    console.error('Error al obtener reservas pendientes:', error);
    res.status(500).json({ error: 'Error interno al consultar solicitudes pendientes' });
  }
};

// GET /api/reservas/cola - Obtener la lista activa de la cola de espera
export const getColaEspera = async (req, res) => {
  try {
    const query = `
      SELECT 
        ce.id_cola,
        ce.posicion,
        u.nombre || ' ' || u.apellido AS usuario_nombre,
        e.nombre_equipo AS equipos,
        ce.fecha_solicitud
      FROM cola_espera ce
      JOIN detalle_reserva dr ON ce.id_detalle_reserva = dr.id_detalle_reserva
      JOIN reservas r ON dr.id_reserva = r.id_reserva
      JOIN usuarios u ON r.id_usuario = u.id_usuario
      JOIN equipos e ON dr.id_equipo = e.id_equipo
      WHERE ce.estado = 'PENDIENTE'
      ORDER BY ce.posicion ASC;
    `;

    const { rows } = await pool.query(query);
    res.json(rows);

  } catch (error) {
    console.error('Error al obtener cola de espera:', error);
    res.status(500).json({ error: 'Error interno al consultar la cola de espera' });
  }
};

// PUT /api/reservas/:id/cancelar - Cancelar una reserva existente
export const cancelarReserva = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar el estado de la reserva principal
    const updateReservaQuery = `
      UPDATE reservas 
      SET estado = 'CANCELADO' 
      WHERE id_reserva = $1 
      RETURNING *;
    `;
    const resultReserva = await client.query(updateReservaQuery, [id]);

    if (resultReserva.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La reserva especificada no existe' });
    }

    // 2. Actualizar también el estado en los detalles asociados
    const updateDetalleQuery = `
      UPDATE detalle_reserva 
      SET estado = 'CANCELADO' 
      WHERE id_reserva = $1;
    `;
    await client.query(updateDetalleQuery, [id]);

    await client.query('COMMIT');

    return res.json({
      mensaje: 'Reserva cancelada exitosamente',
      reserva: resultReserva.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar la reserva:', error);
    return res.status(500).json({ error: 'Error interno al intentar cancelar la reserva' });
  } finally {
    client.release();
  }
};

// PUT /api/reservas/:id/devolver - Solicitar devolución de un equipo en préstamo
export const devolverReserva = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar el estado de la reserva a POR_CONFIRMAR_DEVOLUCION
    const updateReservaQuery = `
      UPDATE reservas 
      SET estado = 'POR_CONFIRMAR_DEVOLUCION' 
      WHERE id_reserva = $1 
      RETURNING *;
    `;
    const resultReserva = await client.query(updateReservaQuery, [id]);

    if (resultReserva.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La reserva especificada no existe' });
    }

    // 2. Actualizar también el detalle de la reserva
    const updateDetalleQuery = `
      UPDATE detalle_reserva 
      SET estado = 'POR_CONFIRMAR_DEVOLUCION' 
      WHERE id_reserva = $1;
    `;
    await client.query(updateDetalleQuery, [id]);

    await client.query('COMMIT');

    return res.json({
      mensaje: 'Solicitud de devolución registrada correctamente',
      reserva: resultReserva.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al solicitar devolución:', error);
    return res.status(500).json({ error: 'Error interno al procesar la devolución' });
  } finally {
    client.release();
  }
};