const API_URL = '/api';
let carritoEquipos = [];
let todosLosEquipos = []; 

function obtenerIdUsuario(usuario) {
    if (!usuario) return null;
    const id = usuario.id_usuario || usuario.id || usuario.id_user;
    return id ? parseInt(id) : null;
}

function obtenerIdEquipo(item) {
    if (!item) return null;
    const id = item.id_equipo || item.id;
    return id ? parseInt(id) : null;
}

window.addEventListener('pageshow', (event) => {
    if (event.persisted || (performance.navigation && performance.navigation.type === 2)) {
        window.location.reload();
    }
});

// 1. ANIMACIÓN DEL BANNER DE BIENVENIDA
function animarTextoBienvenida(nombreUsuario = "Estudiante") {
    const contenedor = document.querySelector('.banner-content h1');
    if (!contenedor) return;

    const textoCompleto = `Bienvenido, `;
    contenedor.innerHTML = `<span id="typewriterText"></span><span class="typing-cursor"></span>`;
    
    const spanText = document.getElementById('typewriterText');
    const cursor = document.querySelector('.typing-cursor');
    
    let index = 0;
    const cadenaTotal = `${textoCompleto}${nombreUsuario}`;

    function escribirLetra() {
        if (index < cadenaTotal.length) {
            if (index >= textoCompleto.length) {
                const parteNombre = cadenaTotal.substring(textoCompleto.length, index + 1);
                spanText.innerHTML = `${textoCompleto}<span class="highlight">${parteNombre}</span>`;
            } else {
                spanText.textContent = cadenaTotal.substring(0, index + 1);
            }
            index++;
            setTimeout(escribirLetra, 60);
        } else {
            setTimeout(() => {
                if (cursor) cursor.style.display = 'none';
            }, 1500);
        }
    }
    escribirLetra();
}

// 2. RELOJ EN TIEMPO REAL
function updateClock() {
    const now = new Date();
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    
    const clockElement = document.getElementById('liveClock');
    if (clockElement) {
        clockElement.textContent = `${now.toLocaleTimeString('en-US', timeOptions)} — ${now.toLocaleDateString('es-ES', dateOptions)}`;
    }
}

// 3. CARGAR CATÁLOGO Y LLENAR DESPLEGABLE CON TIPOS DE EQUIPOS ÚNICOS
async function cargarCatalogoEquipos() {
    const container = document.getElementById('catalogContainer');
    const selectCat = document.getElementById('selectCategoriaFilter');

    try {
        const res = await fetch(`${API_URL}/equipos`);
        if (!res.ok) throw new Error('Error al conectar con la API de inventario');
        
        let datos = await res.json();

        if (!Array.isArray(datos)) {
            datos = datos.equipos || datos.data || [];
        }

        todosLosEquipos = datos;

        if (todosLosEquipos.length === 0) {
            if (container) container.innerHTML = `<p class="text-center" style="color:#94a3b8;">No existen equipos registrados en el laboratorio.</p>`;
            if (selectCat) selectCat.innerHTML = `<option value="">-- No hay categorías --</option>`;
            return;
        }

        const extraerCategoria = (eq) => eq.tipo_equipo_nombre || eq.tipo_equipo || eq.categoria || eq.nombre_categoria || eq.nombre_equipo || eq.tipo || 'General';

        const categoriasUnicas = [...new Set(todosLosEquipos.map(extraerCategoria))].filter(Boolean);

        const seleccionActual = selectCat ? selectCat.value : '';

        let selectOptions = `<option value="">-- Seleccione Tipo de Equipo --</option>`;
        categoriasUnicas.forEach(cat => {
            selectOptions += `<option value="${cat}">${cat}</option>`;
        });
        if (selectCat) selectCat.innerHTML = selectOptions;

        if (seleccionActual && categoriasUnicas.includes(seleccionActual)) {
            if (selectCat) selectCat.value = seleccionActual;
            renderizarEquiposPorCategoria(seleccionActual);
        } else if (container) {
            container.innerHTML = `<p class="text-center" style="color: #94a3b8;">Seleccione un tipo de equipo en el menú desplegable para consultar la disponibilidad.</p>`;
        }

    } catch (err) {
        console.error('Error al cargar catálogo:', err);
        if (container) container.innerHTML = `<p class="text-center" style="color: #f87171;">Error al cargar los equipos del laboratorio.</p>`;
    }
}

// 4. MOSTRAR LOS EQUIPOS DISPONIBLES
function renderizarEquiposPorCategoria(categoriaSeleccionada) {
    const container = document.getElementById('catalogContainer');
    if (!container) return;

    if (!categoriaSeleccionada) {
        container.innerHTML = `<p class="text-center" style="color: #94a3b8;">Seleccione un tipo de equipo en el menú desplegable para consultar la disponibilidad.</p>`;
        return;
    }

    const extraerCategoria = (eq) => eq.tipo_equipo_nombre || eq.tipo_equipo || eq.categoria || eq.nombre_categoria || eq.nombre_equipo || eq.tipo || 'General';

    const equiposFiltrados = todosLosEquipos.filter(eq => {
        const cat = extraerCategoria(eq);
        return cat.toLowerCase() === categoriaSeleccionada.toLowerCase();
    });

    if (equiposFiltrados.length === 0) {
        container.innerHTML = `<p class="text-center" style="color: #94a3b8;">No hay equipos asociados a "${categoriaSeleccionada}".</p>`;
        return;
    }

    let html = `
        <div class="category-block" style="padding-bottom: 2rem;">
            <div class="category-title" style="margin-bottom: 1rem; font-weight: bold; color: #00f2fe;">
                📋 LISTADO DE: ${categoriaSeleccionada.toUpperCase()} (${equiposFiltrados.length} Registros)
            </div>
    `;

    equiposFiltrados.forEach(eq => {
        const id = obtenerIdEquipo(eq);
        const nombreBase = eq.nombre_equipo || eq.nombre || categoriaSeleccionada;
        const marca = eq.marca || '';
        const modelo = eq.modelo || '';
        const estado = (eq.estado || 'DISPONIBLE').toUpperCase();
        const descripcion = eq.descripcion || '';
        const numeroInventario = eq.numero_inventario || eq.codigo || `#${id}`;

        const esDisponible = estado === 'DISPONIBLE';
        const nombreMostrar = `${nombreBase} ${marca} ${modelo}`.trim();

        html += `
            <div class="equipment-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.6); padding: 0.8rem; border-radius: 6px; margin-bottom: 0.6rem; border: 1px solid rgba(255,255,255,0.05);">
                <div class="equipment-info" style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <span class="equipment-name" style="color: #f8fafc; font-weight: 600; font-size: 0.95rem;">
                        ${nombreMostrar}
                    </span>
                    <span class="equipment-code" style="color: #94a3b8; font-size: 0.8rem;">
                        N° Inventario: <strong style="color: #00f2fe;">${numeroInventario}</strong> | Marca: ${marca || 'N/A'} | Modelo: ${modelo || 'N/A'}
                    </span>
                    ${descripcion ? `<span style="color: #64748b; font-size: 0.78rem;">${descripcion}</span>` : ''}
                    <span style="font-size: 0.78rem;">
                        Estado: <strong style="color: ${esDisponible ? '#10b981' : '#f59e0b'};">${estado}</strong>
                    </span>
                </div>
                <div class="actions-container" style="display: flex; gap: 0.5rem; align-items: center;">
                    ${esDisponible ? `
                        <button class="btn-direct-reserve" onclick="reservarDirecto(${id})">⚡ Reservar</button>
                        <button class="btn-add-cart" onclick="agregarAlCarrito(${id}, '${nombreMostrar.replace(/'/g, "\\'")}', '${numeroInventario}')">➕ Carrito</button>
                    ` : `
                        <button class="btn-add-queue" onclick="solicitarColaEspera(${id}, '${nombreMostrar.replace(/'/g, "\\'")}')">⏳ Cola de Espera</button>
                    `}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function reservarDirecto(idEquipo) {
    const equipo = todosLosEquipos.find(eq => obtenerIdEquipo(eq) === parseInt(idEquipo));
    if (!equipo) return;

    const id = obtenerIdEquipo(equipo);
    const nombreBase = equipo.nombre_equipo || equipo.nombre || equipo.categoria || 'Equipo';
    const marca = equipo.marca || '';
    const modelo = equipo.modelo || '';
    const nombreCompleto = `${nombreBase} ${marca} ${modelo}`.trim();
    const codigo = equipo.numero_inventario || equipo.codigo || `#${id}`;

    if (confirm(`¿Deseas solicitar la reserva directa de:\n"${nombreCompleto}" (Inv: ${codigo}) por 2 horas?`)) {
        procesarReservas([{
            id_equipo: id,
            id: id,
            nombre: nombreCompleto,
            codigo: codigo,
            tiempo_uso: 2
        }]);
    }
}

// 5. MANEJO DEL CARRITO
function agregarAlCarrito(id, nombre, codigo) {
    const idInt = parseInt(id);
    const existe = carritoEquipos.find(item => obtenerIdEquipo(item) === idInt);
    
    if (existe) {
        alert('El equipo ya se encuentra en su carrito.');
        return;
    }

    carritoEquipos.push({
        id_equipo: idInt,
        id: idInt,
        nombre: nombre,
        codigo: codigo,
        tiempo_uso: 2
    });

    renderizarCarrito();
}

function removerDelCarrito(id) {
    const idInt = parseInt(id);
    carritoEquipos = carritoEquipos.filter(item => obtenerIdEquipo(item) !== idInt);
    renderizarCarrito();
}

function cambiarTiempoUsoCarrito(id, nuevoTiempo) {
    const idInt = parseInt(id);
    const item = carritoEquipos.find(i => obtenerIdEquipo(i) === idInt);
    if (item) {
        item.tiempo_uso = parseInt(nuevoTiempo) || 2;
    }
}

function renderizarCarrito() {
    let listContainer = document.getElementById('cartList');
    
    if (!listContainer) {
        listContainer = document.querySelector('.cart-items-container');
    }

    const globalControls = document.getElementById('cartGlobalControls');
    
    if (!listContainer && globalControls) {
        listContainer = document.createElement('div');
        listContainer.id = 'cartList';
        globalControls.parentNode.insertBefore(listContainer, globalControls);
    }

    const cartBadge = document.getElementById('cartCountBadge') || document.querySelector('.cart-badge');

    if (cartBadge) {
        cartBadge.textContent = `${carritoEquipos.length} Ítems`;
    }

    if (carritoEquipos.length === 0) {
        if (listContainer) {
            listContainer.innerHTML = `<p style="color: #94a3b8; font-size: 0.9rem; text-align: center; padding: 1rem 0;">No has agregado equipos a tu solicitud.</p>`;
        }
        if (globalControls) globalControls.style.display = 'none';
        return;
    }

    if (globalControls) {
        globalControls.style.display = 'block';
    }

    if (listContainer) {
        listContainer.innerHTML = carritoEquipos.map(item => {
            const idItem = obtenerIdEquipo(item);
            return `
                <div class="cart-item-card">
                    <div class="cart-item-header">
                        <div style="display: flex; flex-direction: column;">
                            <strong style="color: #00f2fe; font-size: 0.92rem; line-height: 1.2;">
                                ${item.nombre}
                            </strong>
                            <span style="color: #94a3b8; font-size: 0.78rem;">Inv: ${item.codigo}</span>
                        </div>
                        <button type="button" onclick="removerDelCarrito(${idItem})" title="Quitar del carrito" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #f87171; border-radius: 4px; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                            ✖ Quitar
                        </button>
                    </div>

                    <div class="cart-item-body">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="color: #cbd5e1; font-size: 0.8rem; white-space: nowrap;">Tiempo Uso:</label>
                            <select onchange="cambiarTiempoUsoCarrito(${idItem}, this.value)">
                                <option value="1" ${item.tiempo_uso === 1 ? 'selected' : ''}>1 Hora</option>
                                <option value="2" ${item.tiempo_uso === 2 ? 'selected' : ''}>2 Horas (Máx)</option>
                            </select>
                        </div>
                        <button type="button" class="btn-secondary-sm" onclick="reservarIndividual(${idItem})" style="background: rgba(0, 242, 254, 0.1); border: 1px solid #00f2fe; color: #00f2fe; border-radius: 4px; padding: 0.35rem 0.65rem; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
                            ⚡ Reservar Solo Este
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// 6. ENVIAR RESERVAS AL BACKEND
async function procesarReservas(listaObjetos) {
    const usuarioRaw = localStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
    
    const idUsuario = obtenerIdUsuario(usuario);

    if (!usuario || !idUsuario) {
        alert('Sesión no válida o caducada. Por favor, vuelve a iniciar sesión.');
        window.location.replace('login.html');
        return;
    }

    const labInput = document.getElementById('cartGlobalLab');
    const labId = labInput && labInput.value ? parseInt(labInput.value) : 1;

    let exitoCount = 0;

    for (const item of listaObjetos) {
        const idEquipoInt = obtenerIdEquipo(item);

        if (!idEquipoInt || isNaN(idEquipoInt)) {
            console.error('ID de equipo no válido:', item);
            continue;
        }

        const ahora = new Date();
        const horasUso = parseInt(item.tiempo_uso) || 2;
        const fechaFin = new Date(ahora.getTime() + horasUso * 60 * 60 * 1000);

        const payload = {
            id_usuario: idUsuario,
            id_laboratorio: labId || 1,
            hora_inicio: ahora.toISOString(),
            hora_fin: fechaFin.toISOString(),
            equipos: [idEquipoInt]
        };

        try {
            const res = await fetch(`${API_URL}/reservas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                exitoCount++;
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('Error reportado por el backend:', errData);
                alert(`Error: ${errData.error || errData.message || 'No se pudo procesar la reserva'}`);
            }
        } catch (err) {
            console.error('Error de red procesando reserva:', err);
        }
    }

    if (exitoCount > 0) {
        alert(`✅ Se han enviado ${exitoCount} solicitud(es) de reserva con éxito.`);
        const idsProcesados = listaObjetos.map(i => obtenerIdEquipo(i));
        carritoEquipos = carritoEquipos.filter(i => !idsProcesados.includes(obtenerIdEquipo(i)));
        renderizarCarrito();
        await cargarCatalogoEquipos();
        cargarMisReservas(idUsuario);
    }
}

function reservarIndividual(id) {
    const idInt = parseInt(id);
    const item = carritoEquipos.find(i => obtenerIdEquipo(i) === idInt);
    if (item) procesarReservas([item]);
}

async function solicitarColaEspera(idEquipo, nombreEquipo) {
    const usuarioRaw = localStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
    const idUsuario = obtenerIdUsuario(usuario);

    if (!usuario || !idUsuario) {
        window.location.replace('login.html');
        return;
    }

    if (confirm(`El equipo "${nombreEquipo}" está ocupado. ¿Desea ingresar a la cola de espera?`)) {
        const ahora = new Date();
        const fechaFin = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);

        const payload = {
            id_usuario: idUsuario,
            id_laboratorio: 1,
            hora_inicio: ahora.toISOString(),
            hora_fin: fechaFin.toISOString(),
            equipos: [parseInt(idEquipo)]
        };

        try {
            const res = await fetch(`${API_URL}/reservas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('⏳ Te has registrado en la cola de espera.');
                cargarMisReservas(idUsuario);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`❌ ${errData.error || errData.message || 'Error al registrar en la cola.'}`);
            }
        } catch (e) {
            alert('❌ Error al registrar en la cola.');
        }
    }
}

// 7. CARGAR MIS RESERVAS (CON CANCELAR Y DEVOLVER)
async function cargarMisReservas(idUsuario) {
    const contenedor = document.getElementById('listaMisReservas');
    if (!contenedor) return;

    try {
        const res = await fetch(`${API_URL}/reservas?id_usuario=${idUsuario}`);
        if (!res.ok) throw new Error(`Error de servidor (${res.status})`);
        
        let respuesta = await res.json();
        
        let todas = [];
        if (Array.isArray(respuesta)) {
            todas = respuesta;
        } else if (Array.isArray(respuesta.reservas)) {
            todas = respuesta.reservas;
        } else if (Array.isArray(respuesta.data)) {
            todas = respuesta.data;
        }

        if (todas.length === 0) {
            contenedor.innerHTML = `<p class="text-center" style="color: #94a3b8;">No tienes solicitudes o préstamos registrados.</p>`;
            return;
        }

        const misReservas = todas.filter(r => {
            const userIdInReserva = r.id_usuario ?? r.id_user ?? r.usuario_id ?? r.user_id;
            if (userIdInReserva === undefined || userIdInReserva === null) return true;
            return String(userIdInReserva) === String(idUsuario);
        });

        if (misReservas.length === 0) {
            contenedor.innerHTML = `<p class="text-center" style="color: #94a3b8;">No tienes solicitudes o préstamos registrados.</p>`;
            return;
        }

        contenedor.innerHTML = misReservas.map(r => {
            const estado = String(r.estado || 'PENDIENTE').toUpperCase();
            let badgeColor = '#f59e0b'; 
            let esDevolvible = false;
            let esCancelable = false;

            if (['ENTREGADO', 'ACTIVO', 'EN USO', 'APROBADA', 'APROBADO'].includes(estado)) {
                badgeColor = '#10b981';
                esDevolvible = true;
            } else if (['PENDIENTE', 'SOLICITADO', 'EN ESPERA', 'EN_COLA'].includes(estado)) {
                badgeColor = '#f59e0b';
                esCancelable = true;
            } else if (estado === 'POR_CONFIRMAR_DEVOLUCION') {
                badgeColor = '#3b82f6';
            } else if (['FINALIZADO', 'DEVUELTO', 'CANCELADO', 'RECHAZADO'].includes(estado)) {
                badgeColor = '#64748b';
            }

            const idReserva = r.id_reserva || r.id;
            const nombreEquipo = r.nombre_equipo || r.equipo || r.nombre || `Reserva #${idReserva}`;

            return `
                <div class="card-item" style="flex-direction: column; align-items: stretch; gap: 0.6rem; background: rgba(30, 41, 59, 0.4); padding: 0.8rem; border-radius: 6px; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #f8fafc;">${nombreEquipo}</strong>
                        <span class="badge" style="background: ${badgeColor}; color: #0f172a; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                            ${estado.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div style="font-size: 0.8rem; color: #cbd5e1; display: flex; justify-content: space-between;">
                        <span>Lab: ${r.laboratorio || r.nombre_laboratorio || r.id_laboratorio || 'General'}</span>
                        <span>Reserva #${idReserva}</span>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem;">
                        ${esCancelable ? `
                            <button onclick="cancelarReserva(${idReserva})" style="flex: 1; padding: 0.4rem; font-size: 0.8rem; border: none; cursor: pointer; text-align: center; background: #dc2626; color: white; border-radius: 4px; font-weight: bold;">
                                 Cancelar Reserva
                            </button>
                        ` : ''}

                        ${esDevolvible ? `
                            <button onclick="solicitarDevolucion(${idReserva})" style="flex: 1; padding: 0.4rem; font-size: 0.8rem; border: none; cursor: pointer; text-align: center; background: #ef4444; color: white; border-radius: 4px; font-weight: bold;">
                                🔄 Devolver Equipo (Check-out)
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error al cargar mis reservas:', err);
        contenedor.innerHTML = `<p class="text-center" style="color: #f87171;">Error al cargar tus reservas.</p>`;
    }
}

// 8. CANCELAR RESERVA
async function cancelarReserva(idReserva) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;

    try {
        let res = await fetch(`${API_URL}/reservas/${idReserva}/cancelar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'CANCELADO' })
        });

        if (res.status === 404) {
            res = await fetch(`${API_URL}/reservas/${idReserva}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'CANCELADO' })
            });
        }

        if (res.ok) {
            alert('✅ Reserva cancelada exitosamente.');
            const usuarioRaw = localStorage.getItem('usuario');
            if (usuarioRaw) {
                const usuario = JSON.parse(usuarioRaw);
                const idUsuario = obtenerIdUsuario(usuario);
                if (idUsuario) cargarMisReservas(idUsuario);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(`❌ Error al cancelar (${res.status}): ${errData.error || errData.message || 'El servidor rechazó la acción'}`);
        }
    } catch (e) {
        console.error('Error al cancelar reserva:', e);
        alert('❌ Error de conexión al intentar cancelar.');
    }
}

// 9. DEVOLVER EQUIPO
async function solicitarDevolucion(idReserva) {
    if (!confirm('¿Deseas notificar la devolución de este equipo?')) return;

    try {
        const res = await fetch(`${API_URL}/reservas/${idReserva}/devolver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'POR_CONFIRMAR_DEVOLUCION' })
        });

        if (res.ok) {
            alert('✅ Devolución notificada al encargado.');
            const usuarioRaw = localStorage.getItem('usuario');
            if (usuarioRaw) {
                const usuario = JSON.parse(usuarioRaw);
                const idUsuario = obtenerIdUsuario(usuario);
                if (idUsuario) cargarMisReservas(idUsuario);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(`❌ Error al solicitar devolución: ${errData.error || errData.message || 'Ocurrió un inconveniente'}`);
        }
    } catch (e) {
        alert('❌ Error al conectar con el servidor.');
    }
}

// 10. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    const usuarioRaw = localStorage.getItem('usuario');
    const usuarioGuardado = usuarioRaw ? JSON.parse(usuarioRaw) : null;
    const idUsuario = obtenerIdUsuario(usuarioGuardado);

    if (!usuarioGuardado || !idUsuario) {
        window.location.replace('login.html');
        return;
    }

    const nombreMostrar = usuarioGuardado.nombre || usuarioGuardado.nombre_usuario || "Estudiante";

    animarTextoBienvenida(nombreMostrar);
    
    setInterval(updateClock, 1000);
    updateClock();

    cargarCatalogoEquipos();
    cargarMisReservas(idUsuario);

    document.getElementById('selectCategoriaFilter')?.addEventListener('change', (e) => {
        renderizarEquiposPorCategoria(e.target.value);
    });

    document.getElementById('btnReloadCatalog')?.addEventListener('click', cargarCatalogoEquipos);
    document.getElementById('btnRefreshMisReservas')?.addEventListener('click', () => {
        cargarMisReservas(idUsuario);
    });

    document.getElementById('btnSubmitCart')?.addEventListener('click', () => {
        if (carritoEquipos.length === 0) return;
        procesarReservas(carritoEquipos);
    });

    document.getElementById('btnLogout')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('login.html');
    });
});