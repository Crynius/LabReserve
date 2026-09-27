import { pool } from '../config/db.js';

// POST /api/uso-equipos/entrega - Entregar equipos cuando el estudiante llega
export const registrarEntrega = async (req, res) => {
  const { id_reserva } = req.body;

  if (!id_reserva) {
    return res.status(400).json({ error: 'El id_reserva es obligatorio' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar si la reserva existe y está PENDIENTE
    const resReserva = await client.query(
      `SELECT * FROM reservas WHERE id_reserva = $1 AND estado = 'PENDIENTE'`,
      [id_reserva]
    );

    if (resReserva.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'La reserva no existe, ya fue reclamada o se encuentra cancelada' 
      });
    }

    // 2. Obtener los detalles de los equipos de esta reserva
    const resDetalles = await client.query(
      `SELECT id_detalle_reserva FROM detalle_reserva WHERE id_reserva = $1`,
      [id_reserva]
    );

    if (resDetalles.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La reserva no tiene equipos asociados' });
    }

    // 3. Definir hora de entrega (ahora) y calcular las 2 horas límite de uso
    const horaEntrega = new Date();
    const horaDevolucionLimite = new Date(horaEntrega.getTime() + (2 * 60 * 60 * 1000));

    // 4. Insertar en uso_equipos Y actualizar el estado en detalle_reserva
    const registrosUso = [];
    for (const detalle of resDetalles.rows) {
      const insertUso = `
        INSERT INTO uso_equipos (id_detalle_reserva, hora_recogida, hora_devolucion, estado_uso)
        VALUES ($1, $2, $3, 'EN_USO')
        RETURNING id_uso, id_detalle_reserva, hora_recogida, hora_devolucion, estado_uso;
      `;
      const usoResult = await client.query(insertUso, [
        detalle.id_detalle_reserva,
        horaEntrega,
        horaDevolucionLimite
      ]);
      registrosUso.push(usoResult.rows[0]);

      // Actualizar detalle_reserva a ENTREGADO
      await client.query(
        `UPDATE detalle_reserva SET estado = 'ENTREGADO' WHERE id_detalle_reserva = $1`,
        [detalle.id_detalle_reserva]
      );
    }

    // 5. Cambiar el estado de la reserva principal a EN_CURSO
    await client.query(
      `UPDATE reservas SET estado = 'EN_CURSO' WHERE id_reserva = $1`,
      [id_reserva]
    );

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Equipo entregado con éxito. Inicia el periodo de 2 horas de uso.',
      registros_uso: registrosUso
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al entregar equipo:', error);
    res.status(500).json({ 
      error: 'Error al registrar la entrega del equipo',
      detalle: error.message 
    });
  } finally {
    client.release();
  }
};


// POST /api/uso-equipos/devolucion - Registrar cuando el usuario devuelve el equipo por ID_USO
export const registrarDevolucion = async (req, res) => {
  const { id_uso } = req.body;

  if (!id_uso) {
    return res.status(400).json({ error: 'El id_uso es obligatorio' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const horaDevolucionReal = new Date();

    // 1. Actualizar uso_equipos
    const updateUsoQuery = `
      UPDATE uso_equipos 
      SET hora_devolucion_real = $1, estado_uso = 'FINALIZADO' 
      WHERE id_uso = $2 AND estado_uso = 'EN_USO'
      RETURNING *;
    `;
    const resultUso = await client.query(updateUsoQuery, [horaDevolucionReal, id_uso]);

    if (resultUso.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El registro de uso no existe o ya fue finalizado' });
    }

    const uso = resultUso.rows[0];

    // 2. Obtener id_equipo e id_reserva del detalle devuelto
    const resDetalle = await client.query(
      `SELECT id_reserva, id_equipo FROM detalle_reserva WHERE id_detalle_reserva = $1`,
      [uso.id_detalle_reserva]
    );
    const { id_reserva, id_equipo } = resDetalle.rows[0];

    // Actualizar estado en detalle_reserva a DEVUELTO
    await client.query(
      `UPDATE detalle_reserva SET estado = 'DEVUELTO' WHERE id_detalle_reserva = $1`,
      [uso.id_detalle_reserva]
    );

    // 3. Verificar si quedan otros equipos pendientes por devolver en esta reserva
    const resPendientes = await client.query(
      `SELECT u.id_uso 
       FROM uso_equipos u
       JOIN detalle_reserva d ON u.id_detalle_reserva = d.id_detalle_reserva
       WHERE d.id_reserva = $1 AND u.estado_uso = 'EN_USO'`,
      [id_reserva]
    );

    if (resPendientes.rows.length === 0) {
      await client.query(
        `UPDATE reservas SET estado = 'FINALIZADA' WHERE id_reserva = $1`,
        [id_reserva]
      );
    }

    // 4. ATENDER COLA DE ESPERA: Promover al siguiente usuario que espere ESTE id_equipo
    const colaRes = await client.query(
      `SELECT ce.id_cola, ce.id_detalle_reserva, dr.id_reserva
       FROM cola_espera ce
       JOIN detalle_reserva dr ON ce.id_detalle_reserva = dr.id_detalle_reserva
       WHERE dr.id_equipo = $1 AND ce.estado = 'PENDIENTE'
       ORDER BY ce.posicion ASC
       LIMIT 1`,
      [id_equipo]
    );

    let siguienteEnCola = null;
    if (colaRes.rows.length > 0) {
      siguienteEnCola = colaRes.rows[0];

      // A. Cambiar estado de la reserva del usuario en cola a PENDIENTE (aparecerá en Solicitudes)
      await client.query(
        `UPDATE reservas SET estado = 'PENDIENTE' WHERE id_reserva = $1`,
        [siguienteEnCola.id_reserva]
      );

      // B. Cambiar el estado en detalle_reserva a SOLICITADO
      await client.query(
        `UPDATE detalle_reserva SET estado = 'SOLICITADO' WHERE id_detalle_reserva = $1`,
        [siguienteEnCola.id_detalle_reserva]
      );

      // C. Marcar el turno de la cola como PROCESADO
      await client.query(
        `UPDATE cola_espera SET estado = 'PROCESADO' WHERE id_cola = $1`,
        [siguienteEnCola.id_cola]
      );

      // D. Reordenar posiciones de los demás en la cola para este equipo
      await client.query(
        `UPDATE cola_espera 
         SET posicion = posicion - 1 
         WHERE id_detalle_reserva IN (
           SELECT id_detalle_reserva FROM detalle_reserva WHERE id_equipo = $1
         ) AND estado = 'PENDIENTE'`,
        [id_equipo]
      );
    }

    await client.query('COMMIT');

    res.json({
      mensaje: 'Devolución registrada exitosamente. Equipo liberado.',
      uso,
      promovido_de_cola: siguienteEnCola ? `Reserva #${siguienteEnCola.id_reserva} promovida a PENDIENTE` : null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al devolver equipo:', error);
    res.status(500).json({ 
      error: 'Error al registrar la devolución',
      detalle: error.message 
    });
  } finally {
    client.release();
  }
};


// POST /api/uso-equipos/devolucion-por-equipo - Registrar devolución directa escaneando/ingresando el ID del equipo
export const registrarDevolucionPorEquipo = async (req, res) => {
  const { id_equipo } = req.body;

  if (!id_equipo) {
    return res.status(400).json({ error: 'El id_equipo es obligatorio' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar el registro de uso activo para este id_equipo
    const buscarUsoQuery = `
      SELECT u.id_uso, u.id_detalle_reserva, dr.id_reserva, e.nombre_equipo
      FROM uso_equipos u
      JOIN detalle_reserva dr ON u.id_detalle_reserva = dr.id_detalle_reserva
      JOIN equipos e ON dr.id_equipo = e.id_equipo
      WHERE dr.id_equipo = $1 AND u.estado_uso = 'EN_USO'
      LIMIT 1;
    `;
    const usoEncontrado = await client.query(buscarUsoQuery, [id_equipo]);

    if (usoEncontrado.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: `El equipo con ID ${id_equipo} no se encuentra prestado (EN_USO) en este momento.` 
      });
    }

    const { id_uso, id_detalle_reserva, id_reserva, nombre_equipo } = usoEncontrado.rows[0];
    const horaDevolucionReal = new Date();

    // 2. Marcar uso_equipos como FINALIZADO
    await client.query(
      `UPDATE uso_equipos SET hora_devolucion_real = $1, estado_uso = 'FINALIZADO' WHERE id_uso = $2`,
      [horaDevolucionReal, id_uso]
    );

    // 3. Marcar detalle_reserva como DEVUELTO
    await client.query(
      `UPDATE detalle_reserva SET estado = 'DEVUELTO' WHERE id_detalle_reserva = $1`,
      [id_detalle_reserva]
    );

    // 4. Verificar si quedan otros equipos pendientes de esta reserva
    const resPendientes = await client.query(
      `SELECT u.id_uso 
       FROM uso_equipos u
       JOIN detalle_reserva d ON u.id_detalle_reserva = d.id_detalle_reserva
       WHERE d.id_reserva = $1 AND u.estado_uso = 'EN_USO'`,
      [id_reserva]
    );

    let reservaCompletada = false;
    if (resPendientes.rows.length === 0) {
      await client.query(
        `UPDATE reservas SET estado = 'FINALIZADA' WHERE id_reserva = $1`,
        [id_reserva]
      );
      reservaCompletada = true;
    }

    // 5. ATENDER COLA DE ESPERA: Revisar si hay un usuario esperando ESTE id_equipo
    const colaRes = await client.query(
      `SELECT ce.id_cola, ce.id_detalle_reserva, dr.id_reserva
       FROM cola_espera ce
       JOIN detalle_reserva dr ON ce.id_detalle_reserva = dr.id_detalle_reserva
       WHERE dr.id_equipo = $1 AND ce.estado = 'PENDIENTE'
       ORDER BY ce.posicion ASC
       LIMIT 1`,
      [id_equipo]
    );

    let siguienteEnCola = null;
    if (colaRes.rows.length > 0) {
      siguienteEnCola = colaRes.rows[0];

      // A. Promover la reserva a PENDIENTE
      await client.query(
        `UPDATE reservas SET estado = 'PENDIENTE' WHERE id_reserva = $1`,
        [siguienteEnCola.id_reserva]
      );

      // B. Actualizar detalle_reserva a SOLICITADO
      await client.query(
        `UPDATE detalle_reserva SET estado = 'SOLICITADO' WHERE id_detalle_reserva = $1`,
        [siguienteEnCola.id_detalle_reserva]
      );

      // C. Marcar el turno como PROCESADO
      await client.query(
        `UPDATE cola_espera SET estado = 'PROCESADO' WHERE id_cola = $1`,
        [siguienteEnCola.id_cola]
      );

      // D. Reordenar posiciones de los demás en la cola
      await client.query(
        `UPDATE cola_espera 
         SET posicion = posicion - 1 
         WHERE id_detalle_reserva IN (
           SELECT id_detalle_reserva FROM detalle_reserva WHERE id_equipo = $1
         ) AND estado = 'PENDIENTE'`,
        [id_equipo]
      );
    }

    await client.query('COMMIT');

    res.json({
      mensaje: `Equipo ${id_equipo} (${nombre_equipo}) devuelto con éxito.`,
      id_reserva,
      reserva_finalizada: reservaCompletada,
      promovido_de_cola: siguienteEnCola ? `Reserva #${siguienteEnCola.id_reserva} promovida a PENDIENTE` : null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al devolver por equipo:', error);
    res.status(500).json({ 
      error: 'Error al registrar la devolución del equipo',
      detalle: error.message 
    });
  } finally {
    client.release();
  }
};


// GET /api/uso-equipos/activos - Obtener lista de equipos prestados actualmente
export const getEquiposActivos = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id_uso,
        e.id_equipo,
        e.nombre_equipo,
        usr.nombre || ' ' || usr.apellido AS nombre_usuario,
        u.hora_recogida AS hora_entrega
      FROM uso_equipos u
      JOIN detalle_reserva dr ON u.id_detalle_reserva = dr.id_detalle_reserva
      JOIN equipos e ON dr.id_equipo = e.id_equipo
      JOIN reservas r ON dr.id_reserva = r.id_reserva
      JOIN usuarios usr ON r.id_usuario = usr.id_usuario
      WHERE u.estado_uso = 'EN_USO'
      ORDER BY u.hora_recogida ASC;
    `;

    const { rows } = await pool.query(query);
    res.json(rows);

  } catch (error) {
    console.error('Error al consultar equipos en uso:', error);
    res.status(500).json({ error: 'Error interno al obtener equipos activos' });
  }
};