// ============================================================
// IAVID — ROL PUBLICADOR: crear posts + subir archivos
// ============================================================
// Requiere que auth.js ya esté cargado antes que este archivo
// (usa supabaseClient y perfilActual definidos ahí).
// ============================================================

const NOMBRE_BUCKET = 'publicaciones-media';

// Límites de validación en el frontend (la validación real de
// seguridad está en las políticas RLS, esto es solo para dar
// buen feedback al usuario antes de gastar su ancho de banda)
const LIMITES_ARCHIVO = {
    imagen: { tamanoMaxMB: 8,  tipos: ['image/jpeg', 'image/png', 'image/webp'] },
    video:  { tamanoMaxMB: 30, tipos: ['video/mp4', 'video/webm'] },
    pdf:    { tamanoMaxMB: 15, tipos: ['application/pdf'] }
};

// ------------------------------------------------------------
// 1. DETECTAR TIPO DE ARCHIVO SEGÚN SU MIME TYPE
// ------------------------------------------------------------
function detectarTipoArchivo(file) {
    if (LIMITES_ARCHIVO.imagen.tipos.includes(file.type)) return 'imagen';
    if (LIMITES_ARCHIVO.video.tipos.includes(file.type)) return 'video';
    if (LIMITES_ARCHIVO.pdf.tipos.includes(file.type)) return 'pdf';
    return null;
}

// ------------------------------------------------------------
// 2. VALIDAR UN ARCHIVO ANTES DE SUBIRLO
// ------------------------------------------------------------
function validarArchivo(file) {
    const tipo = detectarTipoArchivo(file);
    if (!tipo) {
        return { valido: false, error: `Tipo de archivo no permitido: ${file.type || 'desconocido'}. Solo JPG, PNG, WEBP, MP4, WEBM o PDF.` };
    }
    const limiteMB = LIMITES_ARCHIVO[tipo].tamanoMaxMB;
    const tamanoMB = file.size / (1024 * 1024);
    if (tamanoMB > limiteMB) {
        return { valido: false, error: `El archivo "${file.name}" pesa ${tamanoMB.toFixed(1)} MB. El máximo para ${tipo} es ${limiteMB} MB.` };
    }
    return { valido: true, tipo };
}

// ------------------------------------------------------------
// 3. SUBIR UN ARCHIVO AL BUCKET Y REGISTRARLO EN LA TABLA
// ------------------------------------------------------------
async function subirArchivoAdjunto(file, publicacionId) {
    const validacion = validarArchivo(file);
    if (!validacion.valido) throw new Error(validacion.error);

    // Limpia el nombre del archivo (sin espacios ni caracteres raros)
    const nombreLimpio = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
        .replace(/[^a-zA-Z0-9._-]/g, '_');

    const rutaStorage = `${perfilActual.id}/${Date.now()}_${nombreLimpio}`;

    const { error: errorSubida } = await supabaseClient
        .storage
        .from(NOMBRE_BUCKET)
        .upload(rutaStorage, file, { cacheControl: '3600', upsert: false });

    if (errorSubida) throw errorSubida;

    const { error: errorRegistro } = await supabaseClient
        .from('archivos_adjuntos')
        .insert({
            publicacion_id: publicacionId,
            tipo: validacion.tipo,
            ruta_storage: rutaStorage,
            nombre_original: file.name,
            tamano_bytes: file.size
        });

    if (errorRegistro) throw errorRegistro;

    return rutaStorage;
}

// ------------------------------------------------------------
// 4. OBTENER LA URL PÚBLICA DE UN ARCHIVO YA SUBIDO
// ------------------------------------------------------------
function obtenerUrlPublica(rutaStorage) {
    const { data } = supabaseClient.storage.from(NOMBRE_BUCKET).getPublicUrl(rutaStorage);
    return data.publicUrl;
}

// ------------------------------------------------------------
// 5. CREAR UNA PUBLICACIÓN NUEVA (con sus archivos adjuntos)
// ------------------------------------------------------------
// archivosSeleccionados: array de File objects (desde un <input type="file" multiple>)
// ------------------------------------------------------------
async function crearPublicacion({ titulo, categoria, contenido, archivosSeleccionados }) {
    if (!perfilActual || (perfilActual.rol !== 'publicador' && perfilActual.rol !== 'staff')) {
        throw new Error('No tienes permiso para publicar. Tu rol actual no permite crear posts.');
    }

    // Valida TODOS los archivos antes de subir nada (evita subir
    // 2 de 3 y luego fallar a medio camino)
    for (const file of archivosSeleccionados) {
        const v = validarArchivo(file);
        if (!v.valido) throw new Error(v.error);
    }

    const { data: nuevoPost, error: errorPost } = await supabaseClient
        .from('publicaciones')
        .insert({
            autor_id: perfilActual.id,
            titulo,
            categoria,
            contenido
        })
        .select()
        .single();

    if (errorPost) throw errorPost;

    // Sube cada archivo y lo asocia al post recién creado
    const rutasSubidas = [];
    for (const file of archivosSeleccionados) {
        try {
            const ruta = await subirArchivoAdjunto(file, nuevoPost.id);
            rutasSubidas.push(ruta);
        } catch (err) {
            console.error(`Error subiendo "${file.name}":`, err);
            // El post ya existe aunque un archivo falle; se informa
            // al usuario pero no se revierte el post completo.
            throw new Error(`Post creado, pero falló la subida de "${file.name}": ${err.message}`);
        }
    }

    return { post: nuevoPost, archivosSubidos: rutasSubidas };
}

// ------------------------------------------------------------
// 6. MANEJADOR DEL FORMULARIO (conectar con el HTML)
// ------------------------------------------------------------
// Convención esperada en el HTML (ver paso de integración):
//   <form id="form-nueva-publicacion">
//     <input name="titulo">
//     <select name="categoria">...</select>
//     <textarea name="contenido"></textarea>
//     <input type="file" name="archivos" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf">
//   </form>
// ------------------------------------------------------------
async function manejarEnvioPublicacion(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const estadoEl = document.getElementById('publicar-estado');

    const titulo = form.titulo.value.trim();
    const categoria = form.categoria.value;
    const contenido = form.contenido.value.trim();
    const inputArchivos = form.archivos;
    const archivosSeleccionados = inputArchivos.files ? Array.from(inputArchivos.files) : [];

    if (!titulo || !contenido) {
        mostrarEstadoPublicar('Completa al menos el título y el contenido.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Publicando...';
    mostrarEstadoPublicar('', 'oculto');

    try {
        await crearPublicacion({ titulo, categoria, contenido, archivosSeleccionados });
        mostrarEstadoPublicar('✅ ¡Publicación creada con éxito!', 'exito');
        form.reset();
        if (typeof recargarListaPublicaciones === 'function') {
            await recargarListaPublicaciones();
        }
    } catch (error) {
        console.error('Error al publicar:', error);
        mostrarEstadoPublicar(`❌ ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Publicar';
    }
}

function mostrarEstadoPublicar(mensaje, tipo) {
    const estadoEl = document.getElementById('publicar-estado');
    if (!estadoEl) return;
    if (tipo === 'oculto') {
        estadoEl.classList.add('hidden');
        return;
    }
    estadoEl.textContent = mensaje;
    estadoEl.className = tipo === 'exito' ? 'text-xs text-rgbNeon' : 'text-xs text-red-400';
    estadoEl.classList.remove('hidden');
}
