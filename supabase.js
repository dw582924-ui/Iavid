// ============================================================
// 🔌 CLIENTE SUPABASE - IAVID
// ============================================================
// Reemplaza SOLO estas dos líneas con tus datos reales:
// Supabase Dashboard → Settings → API

const SUPABASE_URL      = "https://qiewkzfcckezjvxarqgc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZXdremZjY2tlemp2eGFycWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjM5ODksImV4cCI6MjA5NzM5OTk4OX0.UHyF93Bmjfydo-cdbfCLvfwqr2U75VL_oZ33ePadzJo";

// ── Cliente global ──────────────────────────────────────────
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ── Guardar feedback ────────────────────────────────────────
async function guardarFeedback(comentario) {
    try {
        const { error } = await supabaseClient
            .from("feedback_comentarios")
            .insert({
                comentario: comentario,
                user_agent: navigator.userAgent,
                url_pagina: window.location.href,
            });

        if (error) throw error;

        return { exito: true };

    } catch (err) {
        console.error("❌ Supabase error:", err.message);
        return { exito: false, error: err.message };
    }
}


// ── Registrar visita ────────────────────────────────────────
async function registrarVisita(pagina = "inicio") {
    try {
        const { error } = await supabaseClient
            .from("visitas_pagina")
            .insert({
                pagina:     pagina,
                referrer:   document.referrer || "directo",
                user_agent: navigator.userAgent,
            });

        if (error) throw error;

    } catch (err) {
        console.error("❌ Supabase error:", err.message);
    }
}
