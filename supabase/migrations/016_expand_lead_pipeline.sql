-- Expand lead records for direct sales follow-up.

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS job_title TEXT,
    ADD COLUMN IF NOT EXISTS linkedin TEXT,
    ADD COLUMN IF NOT EXISTS wechat_id TEXT;

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
    ADD CONSTRAINT leads_status_check
    CHECK (status IN ('new', 'contacted', 'converted', 'failed'));
