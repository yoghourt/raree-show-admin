-- SPIKE-IMG-003 — Generate Job queue (Execution Runtime envelope)
-- Apply in Supabase SQL editor before using enqueue / Worker.
-- Job ≠ Candidate ≠ Asset. result_reference is opaque Execution pointer only.

CREATE TABLE IF NOT EXISTS generate_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  capability_id text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  result_reference text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generate_jobs_work_status
  ON generate_jobs (work_id, status);

CREATE INDEX IF NOT EXISTS idx_generate_jobs_status_created
  ON generate_jobs (status, created_at);
