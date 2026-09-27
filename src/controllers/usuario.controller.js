import { pool } from '../config/db.js';

// GET /api/usuarios
export const getUsuarios = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id_usuario, nombre, apellido, correo, rol, fecha_registro FROM usuarios'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// POST /api/usuarios
export const createUsuario = async (req, res) => {
  const { nombre, apellido, correo, password_usuario, rol } = req.body;

  if (!nombre || !apellido || !correo || !password_usuario || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const query = `
      INSERT INTO usuarios (nombre, apellido, correo, password_usuario, rol)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_usuario, nombre, apellido, correo, rol, fecha_registro
    `;
    const values = [nombre, apellido, correo, password_usuario, rol];
    
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
};

// POST /api/usuarios/login
export const loginUsuario = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    // Busca el usuario en PostgreSQL por su correo
    const { rows } = await pool.query(
      'SELECT id_usuario, nombre, apellido, correo, password_usuario, rol FROM usuarios WHERE correo = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'El usuario no existe' });
    }

    const usuario = rows[0];

    // Compara la contraseña enviada desde el formulario con la guardada en la base de datos
    if (usuario.password_usuario !== password) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Devuelve los datos del usuario logueado (incluyendo el rol para la redirección en el frontend)
    res.json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión' });
  }
};