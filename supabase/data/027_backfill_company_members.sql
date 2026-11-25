-- 027 (data, sekali jalan): pemilik serial yang dibuat untuk perusahaan, tapi
-- sudah klaim sebelum 026, dimasukkan ke perusahaannya dan jadi B2B.
-- Hanya company_id dan tier yang diubah. Link profil (slug), link sosial,
-- bio, foto, dan tema pribadi TIDAK disentuh.
-- Profil yang sudah terikat ke perusahaan, atau punya serial dari lebih dari
-- satu perusahaan, dilewati.
-- Sebelum menjalankan: simpan daftar (id, company_id, tier) yang akan berubah
-- untuk rollback.

BEGIN;

WITH target AS (
    SELECT p.id AS profile_id, min(s.company_id::text)::uuid AS company_id
    FROM public.serial_numbers s
    JOIN public.profiles p ON p.user_id = s.owner_id
    WHERE s.company_id IS NOT NULL AND s.is_claimed AND p.company_id IS NULL
    GROUP BY p.id
    HAVING count(DISTINCT s.company_id) = 1
), done AS (
    UPDATE public.profiles p
    SET company_id = t.company_id, tier = 'B2B'
    FROM target t
    WHERE p.id = t.profile_id AND p.company_id IS NULL
    RETURNING p.id
)
SELECT count(*) AS backfilled FROM done;

COMMIT;
