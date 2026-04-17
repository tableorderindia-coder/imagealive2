-- ============================================================
-- FrameAlive — Complete Supabase Database Schema
-- Run this in:  Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ▸ 1. Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ▸ 2. PROJECTS table — core entity
-- ============================================================
-- Each row is one AR experience: an uploaded photo + video pair
-- that generates a QR-scannable AR viewer link.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url     TEXT        NOT NULL,       -- Public URL of the uploaded target photo (Supabase Storage → images bucket)
  video_url     TEXT        NOT NULL,       -- Public URL of the uploaded AR video   (Supabase Storage → videos bucket)
  tracking_url  TEXT        NOT NULL DEFAULT '',  -- Reserved for future marker/tracking image URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on created_at for chronological listings
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects (created_at DESC);

-- Allow public insert + select (the app is unauthenticated / public-facing)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on projects"
  ON public.projects
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access on projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (true);


-- ▸ 3. Storage Buckets
-- ============================================================
-- Run these ONLY if the buckets don't already exist.
-- Supabase SQL editor can create storage buckets via the
-- storage schema.
-- ============================================================

-- Images bucket (for target photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Videos bucket (for AR overlay videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Tracking bucket (for MindAR .mind files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tracking', 'tracking', true)
ON CONFLICT (id) DO NOTHING;


-- ▸ 4. Storage Policies — public read & upload
-- ============================================================

-- IMAGES bucket policies ─────────────────────
CREATE POLICY "Allow public read on images bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');

CREATE POLICY "Allow public upload to images bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'images');

-- VIDEOS bucket policies ─────────────────────
CREATE POLICY "Allow public read on videos bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Allow public upload to videos bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'videos');

-- TRACKING bucket policies ─────────────────────
CREATE POLICY "Allow public read on tracking bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tracking');

CREATE POLICY "Allow public upload to tracking bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'tracking');


-- ============================================================
-- ✅  DONE — Schema is ready for Vercel deployment.
--
--  After running this SQL, set these env vars in Vercel:
--
--   NEXT_PUBLIC_SUPABASE_URL       = https://<project-ref>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY  = <your anon/publishable key>
--   SUPABASE_SERVICE_ROLE_KEY      = <your service role key>
--
-- ============================================================
