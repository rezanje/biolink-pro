-- Editable device and event catalogs. Archive entries instead of deleting history.
CREATE TABLE IF NOT EXISTS public.device_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_types_unique_name ON public.device_types (lower(trim(name)));
CREATE TABLE IF NOT EXISTS public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS events_unique_name ON public.events (lower(trim(name)));
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- Catalog writes and reads are served by the authorized admin API.
REVOKE ALL ON public.device_types, public.events FROM anon, authenticated;
GRANT ALL ON public.device_types, public.events TO service_role;
INSERT INTO public.device_types (name) VALUES ('Jam Tangan'), ('Kartu NFC'), ('Card Holder'), ('Phone Case') ON CONFLICT DO NOTHING;
ALTER TABLE public.serial_numbers
    ADD COLUMN IF NOT EXISTS device_type_id uuid REFERENCES public.device_types(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE RESTRICT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'serial_numbers_company_or_event' AND conrelid = 'public.serial_numbers'::regclass) THEN
        ALTER TABLE public.serial_numbers ADD CONSTRAINT serial_numbers_company_or_event CHECK (company_id IS NULL OR event_id IS NULL);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS serial_numbers_device_type_idx ON public.serial_numbers(device_type_id);
CREATE INDEX IF NOT EXISTS serial_numbers_event_idx ON public.serial_numbers(event_id);
-- Leave existing devices unassigned: the old system did not record device type.
