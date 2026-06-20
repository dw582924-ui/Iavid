// ============================================================
// IAVID — CONEXIÓN SUPABASE + AUTENTICACIÓN
// ============================================================
// Este archivo centraliza:
//   1. La conexión al proyecto Supabase
//   2. Registro / login / logout de usuarios
//   3. Obtener el rol del usuario actual (visitante/publicador/staff)
//   4. Mostrar/ocultar elementos del DOM según el rol
// ============================================================

// ------------------------------------------------------------
// 1. CREDENCIALES DEL PROYECTO
// ------------------------------------------------------------
// ⚠️ REEMPLAZA estos dos valores con los de TU proyecto.
// Los encuentras en: Supabase → Settings → API
//   - "Project URL"      → SUPABASE_URL
//   - "anon public" key  → SUPABASE_ANON_KEY
// Es seguro tenerlos visibles en el frontend: la seguridad
// real la dan las políticas RLS que ya configuramos en SQL.
// ------------------------------------------------------------
const SUPABASE_URL = 'https://qiewkzfcckezjvxarqgc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZXdremZjY2tlemp2eGFycWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjM5ODksImV4cCI6MjA5NzM5OTk4OX0.UHyF93Bmjfydo-cdbfCLvfwqr2U75VL_oZ33ePadzJo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global en memoria: sesión y perfil del usuario actual
let sesionActual = null;
let perfilActual = null; // { id, nombre, rol }

// ------------------------------------------------------------
// 2. REGISTRO DE USUARIO NUEVO
// ------------------------------------------------------------
async function registrarUsuario(email, password, nombre) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { nombre } // se usa en el trigger SQL para el perfil
        }
    });
    if (error) throw error;
    return data;
}

// ------------------------------------------------------------
// 3. LOGIN
// ------------------------------------------------------------
async function iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await cargarPerfilActual();
    return data;
}

// ------------------------------------------------------------
// 4. LOGOUT
// ------------------------------------------------------------
async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    sesionActual = null;
    perfilActual = null;
    actualizarUIPorRol();
}

// ------------------------------------------------------------
// 5. CARGAR PERFIL (id, nombre, rol) DEL USUARIO LOGUEADO
// ------------------------------------------------------------
async function cargarPerfilActual() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    sesionActual = session;

    if (!session) {
        perfilActual = null;
        actualizarUIPorRol();
        return null;
    }

    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('id, nombre, rol')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('Error cargando perfil:', error);
        perfilActual = null;
    } else {
        perfilActual = data;
    }

    actualizarUIPorRol();
    return perfilActual;
}

// ------------------------------------------------------------
// 6. ACTUALIZAR LA INTERFAZ SEGÚN EL ROL ACTUAL
// ------------------------------------------------------------
// Convención usada en el HTML:
//   data-rol-visible="publicador"        → solo visible para publicador o staff
//   data-rol-visible="staff"             → solo visible para staff
//   data-rol-visible="autenticado"       → visible para cualquier usuario logueado
//   data-rol-visible="visitante"         → visible solo si NO hay sesión
// ------------------------------------------------------------
function actualizarUIPorRol() {
    const rol = perfilActual?.rol || null;
    const logueado = !!sesionActual;

    document.querySelectorAll('[data-rol-visible]').forEach(el => {
        const requerido = el.getAttribute('data-rol-visible');
        let mostrar = false;

        if (requerido === 'visitante') mostrar = !logueado;
        else if (requerido === 'autenticado') mostrar = logueado;
        else if (requerido === 'publicador') mostrar = rol === 'publicador' || rol === 'staff';
        else if (requerido === 'staff') mostrar = rol === 'staff';

        el.classList.toggle('hidden', !mostrar);
    });

    // Actualiza el nombre visible en la barra de navegación, si existe
    const nombreEl = document.getElementById('nombre-usuario-actual');
    if (nombreEl) nombreEl.textContent = perfilActual?.nombre || '';
}

// ------------------------------------------------------------
// 7. ESCUCHAR CAMBIOS DE SESIÓN (login/logout en otra pestaña, etc.)
// ------------------------------------------------------------
supabaseClient.auth.onAuthStateChange((_evento, session) => {
    sesionActual = session;
    if (session) {
        cargarPerfilActual();
    } else {
        perfilActual = null;
        actualizarUIPorRol();
    }
});

// ------------------------------------------------------------
// 8. INICIALIZACIÓN AL CARGAR LA PÁGINA
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    cargarPerfilActual();
});
