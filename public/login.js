const formLogin = document.getElementById('formLogin');
const inputEmail = document.getElementById('email');
const inputPassword = document.getElementById('password');
const msgLogin = document.getElementById('msgLogin');

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datoslogin = {
        email: inputEmail.value,
        password: inputPassword.value,
    };

    msgLogin.textContent = "Iniciando sesión...";
    msgLogin.className = "mensaje-feedback";

    try {
        // Petición al endpoint de login
        const res = await fetch('/api/usuarios/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datoslogin)
        });

        const data = await res.json();

        if (res.ok) {
            // Éxito
            msgLogin.textContent = "✅ ¡Inicio de sesión exitoso!";
            msgLogin.classList.add("exito");
            msgLogin.classList.remove("error");

            // Guardamos la información del usuario en localStorage para usarla en otras páginas si es necesario
            if (data.usuario) {
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
            }

            // Redirección según el rol registrado en PostgreSQL
            setTimeout(() => {
                if (data.usuario && data.usuario.rol === 'admin') {
                    // Redirige al panel de administración
                    window.location.href = "admin-panel.html";
                } else {
                    // Redirige a la vista del usuario normal para realizar reservas
                    window.location.href = "reservas.html";
                }
            }, 1000);

        } else {
            // Mensaje de error retornado por Express (400, 401, etc.)
            msgLogin.textContent = "❌ " + (data.error || "Credenciales incorrectas.");
            msgLogin.classList.add("error");
            msgLogin.classList.remove("exito");
        }

    } catch (error) {
        // Error de red
        msgLogin.textContent = "❌ No se pudo conectar con el servidor.";
        msgLogin.classList.add("error");
        msgLogin.classList.remove("exito");
    }
});