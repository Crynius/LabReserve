import express from 'express';
import cors from 'cors'; // <-- 1. Agregar la importación
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';

// Configuración de rutas para ES Modules (__dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares base
app.use(cors()); // <-- 2. Activar CORS antes de definir las rutas
app.use(express.json());

// Servir archivos estáticos del Frontend (carpeta public)
app.use(express.static(path.join(__dirname, '../public')));

// Rutas API
app.use('/api', routes);

export default app;
