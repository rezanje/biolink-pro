const PROFILE_UPDATE_FIELDS = [
    'slug',
    'display_name',
    'bio',
    'company',
    'job_title',
    'avatar_url',
    'phone',
    'email',
    'social_links',
    'special_edition',
    'special_editions',
    'selected_special_greeting_anim',
    'enable_special_greeting_anim',
    'theme',
    'tier',
    'subscription_valid_until',
    'unlocked_templates',
    'feature_grants',
    'user_tag',
    'company_id',
    'updated_at',
]

// Hak akses berbayar: hanya super admin (bukan admin perusahaan, bukan pemilik).
export const SUPER_ADMIN_ONLY_FIELDS = ['tier', 'subscription_valid_until', 'unlocked_templates', 'feature_grants']

const OWNER_UPDATE_FIELDS = new Set(PROFILE_UPDATE_FIELDS.filter(field =>
    ![...SUPER_ADMIN_ONLY_FIELDS, 'user_tag', 'company_id', 'special_edition', 'special_editions'].includes(field)
))

export function touchesSuperAdminFields(updates) {
    return SUPER_ADMIN_ONLY_FIELDS.some(field => Object.prototype.hasOwnProperty.call(updates || {}, field))
}

export function canOwnerUpdate(updates, serialId) {
    return !serialId && Object.keys(updates).every(field => OWNER_UPDATE_FIELDS.has(field))
}

export function buildProfileUpdates(updates) {
    return PROFILE_UPDATE_FIELDS.reduce((profileUpdates, field) => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
            profileUpdates[field] = updates[field]
        }

        return profileUpdates
    }, {})
}
