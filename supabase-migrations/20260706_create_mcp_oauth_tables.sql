-- ============================================================================
-- MCP OAuth store — schema pointer (Opsi A: hosted di Supabase Cuan Insight)
-- ============================================================================
--
-- CATATAN SINKRONISASI:
--   Skema tabel mcp_oauth_* adalah SOURCE OF TRUTH di repo cuan-insight:
--     cuan-insight/supabase/migrations/20260604100000_add_mcp_oauth_persistence.sql
--   Jangan buat CREATE TABLE tandingan di sini agar tidak drift.
--
-- File ini hanya menjaga satu invariant yang dibutuhkan MCP server
-- (SupabaseOAuthStore): connection_key_id HARUS nullable pada
-- mcp_oauth_access_tokens dan mcp_oauth_auth_codes. Bila Edge Function belum
-- mengembalikan connectionKeyId, INSERT dengan NOT NULL akan gagal diam-diam
-- dan token tidak tersimpan -> memicu "reauth required" berulang.
--
-- Perubahan nullable yang sebenarnya dikelola di cuan-insight melalui migration:
--   cuan-insight/supabase/migrations/20260706_make_mcp_oauth_connection_key_id_nullable.sql
--
-- Blok di bawah bersifat IDEMPOTENT dan aman dijalankan berkali-kali. Ia hanya
-- berjalan jika tabelnya sudah ada (dibuat oleh migration cuan-insight).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mcp_oauth_access_tokens'
  ) THEN
    ALTER TABLE public.mcp_oauth_access_tokens
      ALTER COLUMN connection_key_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mcp_oauth_auth_codes'
  ) THEN
    ALTER TABLE public.mcp_oauth_auth_codes
      ALTER COLUMN connection_key_id DROP NOT NULL;
  END IF;
END $$;
