// ============================================================
// IAVID — ROL STAFF (moderador/administrador)
// ============================================================
// Requiere que auth.js esté cargado antes (usa supabaseClient
// y perfilActual).
// Funciones para:
//   1. Listar TODAS las publicaciones (con datos del autor)
//   2. Editar cualquier publicación
//   3. Eliminar cualquier publicación (y sus archivos en Storage)
//   4. Listar usuarios y cambiar su rol
// ============================================================

// ------------------------------------------------------------
// 1. VERIFICACIÓN RÁPIDA: ¿el usuario actual es staff?
// ------------------------------------------------------------
function esStaff() {
    return perfilActual?.rol === 'staff';
}

// ------------------------------------------------------------
// 2. LISTAR TODAS LAS PUBLICACIONES (para el panel de staff)
// ------------------------------------------------------------
async function listarTodasLasPublicaciones() {
    const { data, error } = await supabaseClient
        .from('publicaciones')
        .select(`
            id, titulo, categoria, contenido, creado_en,
            perfiles:autor_id ( nombre ),
            archivos_adjuntos ( id, tipo, ruta_storage, nombre_original )
        `)
        .order('creado_en', { ascending: false });

    if (error) throw error;
    return data;
}

// ------------------------------------------------------------
// 3. EDITAR UNA PUBLICACIÓN (staff puede editar cualquiera,
//    gracias a la política RLS "publicaciones_editar_propio_o_staff")
// ------------------------------------------------------------
async function editarPublicacion(id, { titulo, categoria, contenido }) {
    const { error } = await supabaseClient
        .from('publicaciones')
        .update({ titulo, categoria, contenido, actualizado_en: new Date().toISOString() })
        .eq('id', id);

    if (error) throw error;
}

// ------------------------------------------------------------
// 4. ELIMINAR UNA PUBLICACIÓN COMPLETA
// ------------------------------------------------------------
// Borra primero los archivos físicos del Storage, luego la
// fila de la tabla (lo cual borra en cascada sus referencias
// en archivos_adjuntos gracias al "on delete cascade" del SQL).
// ------------------------------------------------------------
async function eliminarPublicacion(id) {
    const { data: adjuntos, error: errorAdjuntos } = await supabaseClient
        .from('archivos_adjuntos')
        .select('ruta_storage')
        .eq('publicacion_id', id);

    if (errorAdjuntos) throw errorAdjuntos;

    if (adjuntos && adjuntos.length > 0) {
        const rutas = adjuntos.map(a => a.ruta_storage);
        const { error: errorBorradoStorage } = await supabaseClient
            .storage
            .from(NOMBRE_BUCKET)
            .remove(rutas);
        if (errorBorradoStorage) {
            console.warn('Algunos archivos no se pudieron borrar del storage:', errorBorradoStorage);
            // Continúa igual: es preferible borrar el post aunque
            // queden archivos huérfanos, a dejar el post atorado.
        }
    }

    const { error: errorPost } = await supabaseClient
        .from('publicaciones')
        .delete()
        .eq('id', id);

    if (errorPost) throw errorPost;
}

// ------------------------------------------------------------
// 5. LISTAR USUARIOS (para gestionar roles)
// ------------------------------------------------------------
async function listarUsuarios() {
    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('id, nombre, rol, creado_en')
        .order('creado_en', { ascending: false });

    if (error) throw error;
    return data;
}

// ------------------------------------------------------------
// 6. CAMBIAR EL ROL DE UN USUARIO
// ------------------------------------------------------------
async function cambiarRolUsuario(idUsuario, nuevoRol) {
    if (!['visitante', 'publicador', 'staff'].includes(nuevoRol)) {
        throw new Error('Rol inválido.');
    }
    const { error } = await supabaseClient
        .from('perfiles')
        .update({ rol: nuevoRol })
        .eq('id', idUsuario);

    if (error) throw error;
}

// ------------------------------------------------------------
// 7. RENDERIZAR EL PANEL DE STAFF (posts)
// ------------------------------------------------------------
async function renderizarPanelStaffPosts() {
    const contenedor = document.getElementById('staff-lista-posts');
    if (!contenedor || !esStaff()) return;

    contenedor.innerHTML = '<p class="text-gray-500 text-sm">Cargando publicaciones...</p>';

    try {
        const posts = await listarTodasLasPublicaciones();
        if (posts.length === 0) {
            contenedor.innerHTML = '<p class="text-gray-500 text-sm">No hay publicaciones todavía.</p>';
            return;
        }

        contenedor.innerHTML = posts.map(post => `
            <div class="bg-gamingDark border border-gray-800 rounded-lg p-4 flex justify-between items-start gap-4">
                <div class="min-w-0">
                    <p class="text-xs text-rgbCyan uppercase font-bold">${post.categoria}</p>
                    <h4 class="font-bold text-white">${escaparHTML(post.titulo)}</h4>
                    <p class="text-xs text-gray-500 mt-1">Por ${escaparHTML(post.perfiles?.nombre || 'Desconocido')} · ${new Date(post.creado_en).toLocaleDateString('es-PA')}</p>
                    <p class="text-xs text-gray-500 mt-1">${post.archivos_adjuntos?.length || 0} archivo(s) adjunto(s)</p>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button onclick="prepararEdicionPost(${post.id})" class="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-md font-semibold">Editar</button>
                    <button onclick="confirmarEliminarPost(${post.id})" class="text-xs bg-red-900/40 text-red-300 hover:bg-red-900/70 px-3 py-1.5 rounded-md font-semibold">Eliminar</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        contenedor.innerHTML = `<p class="text-red-400 text-sm">Error cargando publicaciones: ${error.message}</p>`;
    }
}

// ------------------------------------------------------------
// 8. CONFIRMAR Y EJECUTAR ELIMINACIÓN DESDE EL PANEL
// ------------------------------------------------------------
async function confirmarEliminarPost(id) {
    if (!confirm('¿Eliminar esta publicación y todos sus archivos adjuntos? Esta acción no se puede deshacer.')) return;
    try {
        await eliminarPublicacion(id);
        await renderizarPanelStaffPosts();
        if (typeof recargarListaPublicaciones === 'function') {
            await recargarListaPublicaciones();
        }
    } catch (error) {
        alert(`Error al eliminar: ${error.message}`);
    }
}

// ------------------------------------------------------------
// 9. RENDERIZAR EL PANEL DE STAFF (usuarios / roles)
// ------------------------------------------------------------
async function renderizarPanelStaffUsuarios() {
    const contenedor = document.getElementById('staff-lista-usuarios');
    if (!contenedor || !esStaff()) return;

    contenedor.innerHTML = '<p class="text-gray-500 text-sm">Cargando usuarios...</p>';

    try {
        const usuarios = await listarUsuarios();
        contenedor.innerHTML = usuarios.map(u => `
            <div class="bg-gamingDark border border-gray-800 rounded-lg p-3 flex justify-between items-center gap-4">
                <div class="min-w-0">
                    <p class="font-semibold text-sm text-white">${escaparHTML(u.nombre)}</p>
                    <p class="text-xs text-gray-500">Rol actual: <span class="text-rgbCyan">${u.rol}</span></p>
                </div>
                <select onchange="confirmarCambioRol('${u.id}', this.value, '${escaparHTML(u.nombre)}')"
                    class="bg-gamingGray border border-gray-700 text-xs rounded-md px-2 py-1.5 text-gray-200">
                    <option value="visitante" ${u.rol === 'visitante' ? 'selected' : ''}>Visitante</option>
                    <option value="publicador" ${u.rol === 'publicador' ? 'selected' : ''}>Publicador</option>
                    <option value="staff" ${u.rol === 'staff' ? 'selected' : ''}>Staff</option>
                </select>
            </div>
        `).join('');
    } catch (error) {
        contenedor.innerHTML = `<p class="text-red-400 text-sm">Error cargando usuarios: ${error.message}</p>`;
    }
}

async function confirmarCambioRol(idUsuario, nuevoRol, nombre) {
    if (!confirm(`¿Cambiar el rol de "${nombre}" a "${nuevoRol}"?`)) {
        await renderizarPanelStaffUsuarios(); // revierte el select visualmente
        return;
    }
    try {
        await cambiarRolUsuario(idUsuario, nuevoRol);
        await renderizarPanelStaffUsuarios();
    } catch (error) {
        alert(`Error al cambiar rol: ${error.message}`);
    }
}

// ------------------------------------------------------------
// 10. UTILIDAD: escapar HTML para evitar inyección al mostrar
//     nombres/títulos que vienen de la base de datos
// ------------------------------------------------------------
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

// ------------------------------------------------------------
// 11. EDICIÓN DE POST (abre un prompt simple; se puede mejorar
//     a un modal completo si lo necesitas más adelante)
// ------------------------------------------------------------
async function prepararEdicionPost(id) {
    try {
        const posts = await listarTodasLasPublicaciones();
        const post = posts.find(p => p.id === id);
        if (!post) return;

        const nuevoTitulo = prompt('Nuevo título:', post.titulo);
        if (nuevoTitulo === null) return;
        const nuevoContenido = prompt('Nuevo contenido (HTML permitido):', post.contenido);
        if (nuevoContenido === null) return;

        await editarPublicacion(id, {
            titulo: nuevoTitulo,
            categoria: post.categoria,
            contenido: nuevoContenido
        });
        await renderizarPanelStaffPosts();
        if (typeof recargarListaPublicaciones === 'function') {
            await recargarListaPublicaciones();
        }
    } catch (error) {
        alert(`Error al editar: ${error.message}`);
    }
}
