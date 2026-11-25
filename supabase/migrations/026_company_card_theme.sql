-- 026: Kartu B2B ikut perusahaan + tema kartu perusahaan.
-- Butuh 025 sudah jalan. Kode aplikasi cabang feat/company-workspace ikut
-- dirilis bersamaan.
--
--   * companies.card_template: tema kartu yang dipakai semua anggota
--     perusahaan (mis. 'cny' untuk Candra Naya Lestari). Kosong = tiap orang
--     memakai tema pilihannya sendiri. Hanya super admin yang bisa mengubahnya.
--   * Klaim serial yang dibuat untuk perusahaan (serial_numbers.company_id)
--     otomatis mengikat profil pemilik ke perusahaan itu dan menjadikannya B2B.
--     Profil yang sudah terikat ke perusahaan lain tidak dipindah.
--
-- Rollback: supabase/rollback/026_company_card_theme_rollback.sql

BEGIN;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS card_template text;

-- Tema perusahaan hanya diatur super admin (admin perusahaan bisa mengubah
-- data perusahaannya, tapi tidak temanya). Perubahan dari pihak lain
-- diabaikan diam-diam.
CREATE OR REPLACE FUNCTION public.nfc_guard_company_template()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') AND NOT public.nfc_is_super_admin() THEN
        IF TG_OP = 'INSERT' THEN
            NEW.card_template := NULL;
        ELSE
            NEW.card_template := OLD.card_template;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nfc_guard_company_template ON public.companies;
CREATE TRIGGER nfc_guard_company_template
    BEFORE INSERT OR UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.nfc_guard_company_template();

CREATE OR REPLACE FUNCTION public.nfc_after_claim(p_user_id uuid, p_serial_id uuid, p_new_claim boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_bundle uuid;
    v_bundle_count int := 0;
    v_bundle_ids uuid[];
    v_editions text[];
    v_promo jsonb;
    v_slug text;
    v_company uuid;
BEGIN
    SELECT bundle_id INTO v_bundle FROM public.serial_numbers WHERE id = p_serial_id;

    IF v_bundle IS NOT NULL THEN
        WITH c AS (
            UPDATE public.serial_numbers
            SET is_claimed = true, owner_id = p_user_id, claimed_at = now()
            WHERE bundle_id = v_bundle AND id <> p_serial_id
              AND is_claimed IS NOT TRUE AND owner_id IS NULL
            RETURNING id
        )
        SELECT count(*), coalesce(array_agg(id), '{}') INTO v_bundle_count, v_bundle_ids FROM c;

        FOR i IN 1 .. coalesce(array_length(v_bundle_ids, 1), 0) LOOP
            PERFORM public.nfc_log_claim(v_bundle_ids[i], p_user_id);
        END LOOP;
    END IF;

    PERFORM public.nfc_ensure_profile(p_user_id);

    -- Kartu/jam yang dibuat untuk perusahaan (B2B): pemiliknya otomatis jadi
    -- anggota perusahaan itu dan tier B2B. Profil yang sudah terikat ke
    -- perusahaan lain tidak dipindah.
    IF p_new_claim THEN
        SELECT company_id INTO v_company FROM public.serial_numbers WHERE id = p_serial_id;
        IF v_company IS NOT NULL THEN
            UPDATE public.profiles
            SET company_id = v_company, tier = 'B2B'
            WHERE user_id = p_user_id AND (company_id IS NULL OR company_id = v_company);
        END IF;
    END IF;

    SELECT ARRAY(
        SELECT DISTINCT e FROM (
            SELECT jsonb_array_elements_text(public.nfc_json_array(p.special_editions)) e FROM public.profiles p WHERE p.user_id = p_user_id
            UNION SELECT p.special_edition FROM public.profiles p WHERE p.user_id = p_user_id
            UNION SELECT jsonb_array_elements_text(public.nfc_json_array(s.special_editions)) FROM public.serial_numbers s
                  WHERE s.id = p_serial_id OR (v_bundle IS NOT NULL AND s.bundle_id = v_bundle AND s.owner_id = p_user_id)
            UNION SELECT s.special_edition FROM public.serial_numbers s
                  WHERE s.id = p_serial_id OR (v_bundle IS NOT NULL AND s.bundle_id = v_bundle AND s.owner_id = p_user_id)
        ) t WHERE e IS NOT NULL AND e <> '' ORDER BY e
    ) INTO v_editions;

    IF cardinality(v_editions) > 0 THEN
        UPDATE public.profiles
        SET special_editions = to_jsonb(v_editions),
            special_edition = coalesce(special_edition, v_editions[1])
        WHERE user_id = p_user_id;
    END IF;

    IF p_new_claim THEN
        v_promo := public.nfc_apply_promo(p_user_id, p_serial_id);
    END IF;
    SELECT slug INTO v_slug FROM public.profiles WHERE user_id = p_user_id;

    RETURN jsonb_build_object('bundle_claimed', v_bundle_count, 'promo', v_promo, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.nfc_after_claim(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
