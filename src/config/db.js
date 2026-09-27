// src/config/db.js
import pkg from 'pg';
import dotenv from 'dotenv';

// Carga las variables de entorno del archivo .env
dotenv.config();

const { Pool } = pkg;

// Creamos un "pool" de conexiones
export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Probamos la conexión al iniciar
pool.connect()
  .then(() => console.log('Conectado exitosamente a PostgreSQL'))
  .catch((err) => console.error('Error al conectar a PostgreSQL:', err.message));