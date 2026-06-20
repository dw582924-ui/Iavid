-- ============================================================
-- 🗄️ SCHEMA SUPABASE - IAVID
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ── TABLA 1: Comentarios / Feedback del sitio ─────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_comentarios (
  id            BIGSERIAL PRIMARY KEY,
  comentario    TEXT          NOT NULL CHECK (char_length(comentario) BETWEEN 3 AND 1000),
  user_agent    TEXT,
  url_pagina    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_created ON feedback_comentarios (created_at DESC);

ALTER TABLE feedback_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede insertar feedback"
  ON feedback_comentarios FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Solo admins pueden leer feedback"
  ON feedback_comentarios FOR SELECT
  USING (auth.role() = 'authenticated');


-- ── TABLA 2: Registro de visitas (analytics básico propio) ────────────────

CREATE TABLE IF NOT EXISTS visitas_pagina (
  id            BIGSERIAL PRIMARY KEY,
  pagina        TEXT          NOT NULL DEFAULT 'inicio',
  referrer      TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitas_created ON visitas_pagina (created_at DESC);
CREATE INDEX idx_visitas_pagina  ON visitas_pagina (pagina);

ALTER TABLE visitas_pagina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede registrar visita"
  ON visitas_pagina FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Solo admins pueden ver visitas"
  ON visitas_pagina FOR SELECT
  USING (auth.role() = 'authenticated');


-- ── VISTA: resumen de feedback por día ────────────────────────────────────

CREATE OR REPLACE VIEW resumen_feedback_diario AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Panama') AS fecha,
  COUNT(*)                                        AS total_comentarios
FROM feedback_comentarios
GROUP BY 1
ORDER BY 1 DESC;


-- ── VISTA: visitas por día y página ───────────────────────────────────────

CREATE OR REPLACE VIEW resumen_visitas_diario AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Panama') AS fecha,
  pagina,
  COUNT(*)                                        AS visitas
FROM visitas_pagina
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
