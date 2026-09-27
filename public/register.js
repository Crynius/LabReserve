document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM usando los IDs exactos del HTML
    const formRegister = document.getElementById('formRegister');
    const msgRegister = document.getElementById('msgRegister');

    if (!formRegister) {
        console.error('No se encontró el formulario con id="formRegister"');
        return;
    }

    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita la recarga automática del formulario

        // Limpia mensajes de error previos
        if (msgRegister) {
            msgRegister.textContent = '';
        }

        // Obtener valores ingresados en los inputs
        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido').value.trim();
        const correo = document.getElementById('correo').value.trim();
        const password_usuario = document.getElementById('password_usuario').value;
        const confirm_password = document.getElementById('confirm_password').value;

        // Validar coincidencia de contraseñas en el frontend
        if (password_usuario !== confirm_password) {
            if (msgRegister) {
                msgRegister.textContent = 'Las contraseñas no coinciden.';
            } else {
                alert('Las contraseñas no coinciden.');
            }
            return;
        }

        // Estructurar los datos según los campos esperados por createUsuario
        const userData = {
            nombre,
            apellido,
            correo,
            password_usuario,
            rol: 'Estudiante'
        };

        try {
            // Petición POST al endpoint de registro
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                alert('¡Usuario creado con éxito! Redirigiendo al login...');
                window.location.href = 'login.html';
            } else {
                // Mostrar mensaje devuelto por PostgreSQL/Backend (ej: correo duplicado)
                if (msgRegister) {
                    msgRegister.textContent = data.error || 'No se pudo completar el registro.';
                } else {
                    alert(data.error || 'No se pudo completar el registro.');
                }
            }
        } catch (error) {
            console.error('Error al intentar registrar usuario:', error);
            if (msgRegister) {
                msgRegister.textContent = 'Error de conexión con el servidor.';
            } else {
                alert('No se pudo conectar con el servidor.');
            }
        }
    });
});