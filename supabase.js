// ============================================================
// 🔌 CLIENTE SUPABASE - IAVID
// Compatible con CDN (vanilla JS / HTML puro)
// ============================================================

// Reemplaza con tus credenciales reales desde:
// https://supabase.com/dashboard → tu proyecto → Settings → API

const SUPABASE_URL     = "https://qiewkzfcckezjvxarqgc.supabase.co";  // ← reemplazar
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZXdremZjY2tlemp2eGFycWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjM5ODksImV4cCI6MjA5NzM5OTk4OX0.UHyF93Bmjfydo-cdbfCLvfwqr2U75VL_oZ33ePadzJo";                 // ← reemplazar

// Cliente global (el objeto 'supabase' viene del CDN cargado en index.html)
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ============================================================
// 📨 Guardar comentario de feedback
// Llamada desde procesarFeedback() en index.html
// ============================================================
async function guardarFeedback(comentario) {
    try {
        const { data, error } = await supabaseClient
            .from("feedback_comentarios")
            .insert([
                {
                    comentario:  comentario,
                    user_agent:  navigator.userAgent,
                    url_pagina:  window.location.href,
                }
            ]);

        if (error) {
            console.error("❌ Error al guardar feedback:", error.message);
            return { exito: false, error: error.message };
        }

        console.log("✅ Feedback guardado:", data);
        return { exito: true, data };

    } catch (err) {
        console.error("❌ Error inesperado:", err);
        return { exito: false, error: err.message };
    }
}


// ============================================================
// 📊 Registrar visita de página (analytics básico)
// Llamada desde window.onload en index.html
// ============================================================
async function registrarVisita(pagina = "inicio") {
    try {
        const { error } = await supabaseClient
            .from("visitas_pagina")
            .insert([
                {
                    pagina:     pagina,
                    referrer:   document.referrer || "directo",
                    user_agent: navigator.userAgent,
                }
            ]);

        if (error) {
            console.error("❌ Error al registrar visita:", error.message);
        }
    } catch (err) {
        console.error("❌ Error inesperado:", err);
    }
}
