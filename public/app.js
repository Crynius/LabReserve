// Cargar fechas automáticamente por defecto (hora actual y +1 hora)
window.addEventListener('DOMContentLoaded', () => {
  const ahora = new Date();
  const unaHoraDespues = new Date(ahora.getTime() + (60 * 60 * 1000));

  document.getElementById('crearInicio').value = formatoFechaLocal(ahora);
  document.getElementById('crearFin').value = formatoFechaLocal(unaHoraDespues);
});

function formatoFechaLocal(fecha) {
  const offset = fecha.getTimezoneOffset();
  const fechaAjustada = new Date(fecha.getTime() - (offset * 60 * 1000));
  return fechaAjustada.toISOString().slice(0, 16);
}

// 1. CREAR RESERVA (Con id_usuario: 1 e id_laboratorio: 1 quemados para pruebas)
document.getElementById('formReserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgBox = document.getElementById('msgCrear');

  const id_usuario = 1;     // Fijo para pruebas rápidas
  const id_laboratorio = 1; // Fijo para pruebas rápidas
  const equiposInput = document.getElementById('crearEquipos').value;
  const hora_inicio = document.getElementById('crearInicio').value;
  const hora_fin = document.getElementById('crearFin').value;

  const equipos = equiposInput.split(',').map(num => parseInt(num.trim())).filter(num => !isNaN(num));

  try {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario, id_laboratorio, hora_inicio, hora_fin, equipos })
    });

    const data = await res.json();

    if (res.ok) {
      const idRes = data.reserva ? data.reserva.id_reserva : '';
      mostrarMensaje(msgBox, `✅ Reserva #${idRes} creada exitosamente.`, 'exito');
      
      // Colocar automáticamente el ID en el input de entrega para probar de un toque
      if (idRes) {
        document.getElementById('inputEntregaReserva').value = idRes;
      }
    } else {
      mostrarMensaje(msgBox, `❌ ${data.error}`, 'error');
    }
  } catch (err) {
    mostrarMensaje(msgBox, '❌ Error al conectar con el servidor', 'error');
  }
});

// 2. ENTREGAR RESERVA
async function entregarReserva() {
  const input = document.getElementById('inputEntregaReserva');
  const msgBox = document.getElementById('msgEntrega');
  const id_reserva = input.value.trim();

  if (!id_reserva) {
    mostrarMensaje(msgBox, 'Ingrese un ID de reserva.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/uso-equipos/entrega', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_reserva: parseInt(id_reserva) })
    });

    const data = await res.json();

    if (res.ok) {
      mostrarMensaje(msgBox, `✅ ${data.mensaje}`, 'exito');
    } else {
      mostrarMensaje(msgBox, `❌ ${data.error}`, 'error');
    }
  } catch (err) {
    mostrarMensaje(msgBox, '❌ Error de conexión con el servidor', 'error');
  }
}

// 3. DEVOLVER EQUIPO
async function devolverEquipo() {
  const input = document.getElementById('inputDevolucionEquipo');
  const msgBox = document.getElementById('msgDevolucion');
  const id_equipo = input.value.trim();

  if (!id_equipo) {
    mostrarMensaje(msgBox, 'Ingrese el ID del equipo.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/uso-equipos/devolucion-por-equipo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_equipo: parseInt(id_equipo) })
    });

    const data = await res.json();

    if (res.ok) {
      let texto = `✅ ${data.mensaje}`;
      if (data.reserva_finalizada) {
        texto += ' 🎉 (Toda la reserva ha finalizado)';
      }
      mostrarMensaje(msgBox, texto, 'exito');
      input.value = '';
      input.focus();
    } else {
      mostrarMensaje(msgBox, `❌ ${data.error}`, 'error');
    }
  } catch (err) {
    mostrarMensaje(msgBox, '❌ Error de conexión con el servidor', 'error');
  }
}

// Atajos Enter
document.getElementById('inputEntregaReserva').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') entregarReserva();
});

document.getElementById('inputDevolucionEquipo').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') devolverEquipo();
});

function mostrarMensaje(elem, texto, tipo) {
  elem.innerText = texto;
  elem.className = `feedback ${tipo}`;
}