-- Calendar tokens are server-only. Visitors submit requests through validated server routes.
CREATE TABLE public.calendar_connections (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    google_account_id text NOT NULL,
    encrypted_tokens jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_connections FROM anon, authenticated;
GRANT ALL ON public.calendar_connections TO service_role;

CREATE TABLE public.meeting_settings (
    profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    timezone text NOT NULL DEFAULT 'Asia/Jakarta',
    duration integer NOT NULL DEFAULT 30 CHECK (duration IN (15,30,60)),
    weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
    start text NOT NULL DEFAULT '09:00' CHECK (start ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'),
    "end" text NOT NULL DEFAULT '17:00' CHECK ("end" ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$' AND "end" > start),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_settings_owner_read ON public.meeting_settings FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
);
REVOKE ALL ON public.meeting_settings FROM anon, authenticated;
GRANT SELECT ON public.meeting_settings TO authenticated;
GRANT ALL ON public.meeting_settings TO service_role;

CREATE TABLE public.meeting_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    visitor_name text NOT NULL CHECK (char_length(visitor_name) BETWEEN 2 AND 100),
    visitor_email text NOT NULL CHECK (char_length(visitor_email) BETWEEN 3 AND 254),
    note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL CHECK (end_at > start_at),
    timezone text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approving','approved','rejected')),
    approval_attempt uuid,
    approval_recovery boolean NOT NULL DEFAULT false,
    approval_calendar_account_id text,
    approval_calendar_email text,
    calendar_event_id text,
    calendar_event_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_requests_profile_created ON public.meeting_requests(profile_id, created_at DESC);
CREATE INDEX meeting_requests_overlap ON public.meeting_requests(profile_id, start_at, end_at) WHERE status IN ('approved','approving');
ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_requests_owner_read ON public.meeting_requests FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid())
);
REVOKE ALL ON public.meeting_requests FROM anon, authenticated;
GRANT SELECT ON public.meeting_requests TO authenticated;
GRANT ALL ON public.meeting_requests TO service_role;

-- Serialize claims per owner/profile, including different requests for overlapping slots.
CREATE FUNCTION public.claim_meeting_request(p_request_id uuid, p_owner_id uuid, p_attempt uuid, p_calendar_account_id text, p_calendar_email text)
RETURNS SETOF public.meeting_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile_id uuid;
BEGIN
    SELECT r.profile_id INTO v_profile_id FROM public.meeting_requests r JOIN public.profiles p ON p.id=r.profile_id
        WHERE r.id=p_request_id AND p.user_id=p_owner_id;
    IF v_profile_id IS NULL THEN RETURN; END IF;
    PERFORM 1 FROM public.profiles WHERE id=v_profile_id FOR UPDATE;
    RETURN QUERY UPDATE public.meeting_requests r SET status='approving', approval_attempt=p_attempt, approval_recovery=(r.status='approving'),
        approval_calendar_account_id=coalesce(r.approval_calendar_account_id,p_calendar_account_id),
        approval_calendar_email=coalesce(r.approval_calendar_email,p_calendar_email), updated_at=now()
        WHERE r.id=p_request_id AND (r.status='pending' OR (r.status='approving' AND r.updated_at < now()-interval '5 minutes' AND r.approval_calendar_account_id=p_calendar_account_id))
        AND p_calendar_account_id IS NOT NULL AND p_calendar_account_id<>''
        AND NOT EXISTS (SELECT 1 FROM public.meeting_requests other WHERE other.profile_id=v_profile_id
            AND other.id<>r.id AND other.status IN ('approving','approved') AND other.start_at<r.end_at AND other.end_at>r.start_at)
        RETURNING r.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_meeting_request(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meeting_request(uuid,uuid,uuid,text,text) TO service_role;
