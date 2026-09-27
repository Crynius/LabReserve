const API_URL = '/api'; // URL base de Express

// Estado global en memoria
let estadoDashboard = {
    reservasPendientes: [],
    equiposEnUso: [],
    colaEspera: [],
    retrasos: [],
    totalEquipos: 0 
};

// DETECTAR NAVEGACIÓN DESDE CACHÉ (BOTÓN ATRÁS/ADELANTE) Y FORZAR RECARGA
window.addEventListener('pageshow', (event) => {
    if (event.persisted || (performance.navigation && performance.navigation.type === 2)) {
        window.location.reload();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // 0. VERIFICACIÓN DE SESIÓN (Redirige de inmediato si cerró sesión)
    if (!localStorage.getItem('usuario')) {
        window.location.replace('login.html');
        return;
    }

    // 1. Cargar los datos inmediatamente
    cargarDashboard();

    // 2. Evento del botón "🔄 Actualizar"
    const btnRefresh = document.getElementById('btnRefreshReservas');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', cargarDashboard);
    }

    // 3. Evento del botón "Cerrar Sesión" (Modificado para usar replace)
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            localStorage.removeItem('token');
            window.location.replace('login.html'); // <--- Reemplaza el historial
        });
    }

    // 4. Evento del Buscador
    const inputSearch = document.getElementById('inputSearch');
    if (inputSearch) {
        inputSearch.addEventListener('input', (e) => filtrarListas(e.target.value.trim().toLowerCase()));
    }
});


// 1. CONSULTA DE DATOS AL BACKEND (GET)

async function cargarDashboard() {
    try {
        // [CAMBIADO] Consultamos en paralelo reservas pendientes, equipos activos, cola de espera y total de equipos
        const [resReservas, resUsos, resCola, resTotalEquipos] = await Promise.all([
            fetch(`${API_URL}/reservas/pendientes`),
            fetch(`${API_URL}/uso-equipos/activos`),
            fetch(`${API_URL}/reservas/cola`),
            fetch(`${API_URL}/equipos/total`) // <--- [AÑADIDO] Petición para obtener el total de equipos en inventario
        ]);

        estadoDashboard.reservasPendientes = resReservas.ok ? await resReservas.json() : [];
        estadoDashboard.equiposEnUso = resUsos.ok ? await resUsos.json() : [];
        estadoDashboard.colaEspera = resCola.ok ? await resCola.json() : [];

        // [AÑADIDO] Guardar el total devuelto por el backend (o usar 90 por defecto)
        const dataTotal = resTotalEquipos.ok ? await resTotalEquipos.json() : { total: 90 };
        estadoDashboard.totalEquipos = dataTotal.total;

        // Procesar reglas de negocio y renderizar en el HTML
        procesarYRenderizar();

    } catch (error) {
        console.error('Error al conectar con el servidor:', error);
    }
}


// 2. PROCESAMIENTO Y RENDERIZADO EN EL HTML

function procesarYRenderizar() {
    const ahora = new Date();
    const activosNormales = [];
    const retrasados = [];

    // Clasificación basada en el límite de 2 horas de préstamo
    estadoDashboard.equiposEnUso.forEach(item => {
        const horaEntrega = new Date(item.hora_entrega || item.hora_inicio);
        const diferenciaMilisegundos = ahora - horaEntrega;
        const horasTranscurridas = diferenciaMilisegundos / (1000 * 60 * 60);

        if (horasTranscurridas > 2) {
            retrasados.push(item);
        } else {
            activosNormales.push(item);
        }
    });

    estadoDashboard.retrasos = retrasados;

    // A. Renderizar Tabla de Solicitudes de Reserva
    renderizarTablaSolicitudes(estadoDashboard.reservasPendientes);

    // B. Renderizar Tarjeta de Equipos Activos (En Uso Normal)
    renderizarEquiposActivos(activosNormales);

    // C. Renderizar Tarjeta de Devoluciones Retrasadas (>2h)
    renderizarRetrasos(retrasados);

    // D. Renderizar Lista de Cola de Espera
    renderizarColaEspera(estadoDashboard.colaEspera);

    // E. Actualizar Tarjetas KPI (incluyendo Cola)
    actualizarKPIs(
        estadoDashboard.reservasPendientes.filter(r => r.estado !== 'EN_COLA').length,
        estadoDashboard.equiposEnUso.length,
        retrasados.length,
        estadoDashboard.colaEspera.length
    );
}

// --- RENDERIZADORES ESPECÍFICOS ---

function renderizarTablaSolicitudes(lista) {
    const tbody = document.getElementById('tablaSolicitudes');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay solicitudes pendientes</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(res => {
        // Normalizar el estado a mayúsculas
        const estadoLimpio = String(res.estado || '').trim().toUpperCase();
        const esCola = estadoLimpio === 'EN_COLA';
        
        // Si la reserva está en cola, bloquea el botón y muestra el indicador
        const celdaAccion = esCola 
            ? `<span style="background: #f59e0b; color: #1e293b; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">⏳ En Cola</span>`
            : `<button class="btn-action approve" onclick="autorizarEntrega(${res.id_reserva})">✅ Entregar</button>`;

        return `
            <tr>
                <td>${res.usuario_nombre || res.nombre_usuario || `Usuario #${res.id_usuario}`}</td>
                <td>${res.equipos || res.nombre_equipo || `Reserva #${res.id_reserva}`}</td>
                <td>${formatearHora(res.hora_inicio)}</td>
                <td>${celdaAccion}</td>
            </tr>
        `;
    }).join('');
}

function renderizarEquiposActivos(lista) {
    const contenedor = document.getElementById('listaActivos');
    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center">Sin equipos en uso actualmente.</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(item => `
        <div class="card-item">
            <div class="card-info">
                <strong>${item.nombre_equipo || `Equipo #${item.id_equipo}`}</strong>
                <span>Usuario: ${item.nombre_usuario || `ID #${item.id_usuario}`}</span>
            </div>
            <button class="btn-action return" onclick="procesarDevolucion(${item.id_equipo})">
                📥 Recibir
            </button>
        </div>
    `).join('');
}

function renderizarRetrasos(lista) {
    const contenedor = document.getElementById('listaRetrasos');
    const countBadge = document.getElementById('countRetrasos');

    if (countBadge) countBadge.textContent = lista.length;
    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center">Sin devoluciones retrasadas por el momento.</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(item => `
        <div class="card-item alert-item">
            <div class="card-info">
                <strong style="color: var(--danger-color, #f87171);">${item.nombre_equipo || `Equipo #${item.id_equipo}`}</strong>
                <span>Retrasado — Usuario: ${item.nombre_usuario || `ID #${item.id_usuario}`}</span>
            </div>
            <button class="btn-action danger" onclick="procesarDevolucion(${item.id_equipo})">
                 Devolver
            </button>
        </div>
    `).join('');
}

function renderizarColaEspera(lista) {
    const contenedor = document.getElementById('listaCola');
    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="text-center">Sin solicitudes en cola de espera.</p>`;
        return;
    }

    contenedor.innerHTML = lista.map((item, index) => `
        <div class="card-item">
            <div class="card-info">
                <strong>#${index + 1} - ${item.nombre_equipo || item.equipos || 'Equipo'}</strong>
                <span>Usuario: ${item.usuario_nombre || item.nombre_usuario || `ID #${item.id_usuario}`}</span>
            </div>
            <span class="badge bg-secondary">En espera</span>
        </div>
    `).join('');
}

function actualizarKPIs(pendientes, enUso, retrasos, cola) {
    const elemPend = document.getElementById('kpiPendientes');
    const elemUso = document.getElementById('kpiEnUso');
    const elemDisp = document.getElementById('kpiDisponibles');
    const elemCola = document.getElementById('kpiCola');

    if (elemPend) elemPend.textContent = pendientes;
    if (elemUso) elemUso.textContent = enUso;
    if (elemCola) elemCola.textContent = cola;

    // [CAMBIADO] Toma dinámicamente el total de la base de datos traído en estadoDashboard.totalEquipos
    const totalBodega = estadoDashboard.totalEquipos || 90; 
    const disponibles = Math.max(0, totalBodega - enUso);
    if (elemDisp) elemDisp.textContent = disponibles;

    if (typeof actualizarGraficoInventario === 'function') {
        actualizarGraficoInventario(disponibles, enUso - retrasos, retrasos);
    }
}


// 3. ACCIONES POST (ENTREGA Y DEVOLUCIÓN)


async function autorizarEntrega(idReserva) {
    if (!confirm(`¿Confirmar entrega física de los equipos para la reserva #${idReserva}?`)) return;

    try {
        const res = await fetch(`${API_URL}/uso-equipos/entrega`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_reserva: parseInt(idReserva) })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`✅ ${data.mensaje || 'Entrega registrada exitosamente'}`);
            cargarDashboard();
        } else {
            alert(`❌ ${data.error || 'No se pudo registrar la entrega'}`);
        }
    } catch (err) {
        alert('❌ Error de conexión al intentar entregar la reserva');
    }
}

async function procesarDevolucion(idEquipo) {
    if (!confirm(`¿Registrar devolución del equipo #${idEquipo}?`)) return;

    try {
        const res = await fetch(`${API_URL}/uso-equipos/devolucion-por-equipo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_equipo: parseInt(idEquipo) })
        });

        const data = await res.json();

        if (res.ok) {
            let mensaje = `✅ ${data.mensaje}`;
            if (data.reserva_finalizada) {
                mensaje += '  (Todos los equipos de la reserva han sido devueltos)';
            }
            alert(mensaje);
            cargarDashboard();
        } else {
            alert(`❌ ${data.error || 'Error al procesar la devolución'}`);
        }
    } catch (err) {
        alert('❌ Error de conexión al registrar la devolución');
    }
}


// 4. FUNCIONES AUXILIARES Y FILTROS


function formatearHora(strFecha) {
    if (!strFecha) return '--:--';
    const fecha = new Date(strFecha);
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function filtrarListas(termino) {
    if (!termino) {
        procesarYRenderizar();
        return;
    }

    const pendientesFiltradas = estadoDashboard.reservasPendientes.filter(r => 
        (r.usuario_nombre && r.usuario_nombre.toLowerCase().includes(termino)) ||
        (r.equipos && r.equipos.toLowerCase().includes(termino)) ||
        String(r.id_reserva).includes(termino)
    );

    const activosFiltrados = estadoDashboard.equiposEnUso.filter(e => 
        (e.nombre_usuario && e.nombre_usuario.toLowerCase().includes(termino)) ||
        (e.nombre_equipo && e.nombre_equipo.toLowerCase().includes(termino)) ||
        String(e.id_equipo).includes(termino)
    );

    renderizarTablaSolicitudes(pendientesFiltradas);
    renderizarEquiposActivos(activosFiltrados.filter(e => !estadoDashboard.retrasos.includes(e)));
    renderizarRetrasos(estadoDashboard.retrasos.filter(e => 
        (e.nombre_usuario && e.nombre_usuario.toLowerCase().includes(termino)) ||
        (e.nombre_equipo && e.nombre_equipo.toLowerCase().includes(termino))
    ));
}