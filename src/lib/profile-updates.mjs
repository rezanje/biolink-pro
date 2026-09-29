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
    'user_tag',
    'company_id',
    'updated_at',
]

const OWNER_UPDATE_FIELDS = new Set(PROFILE_UPDATE_FIELDS.filter(field =>
    !['tier', 'user_tag', 'company_id', 'special_edition', 'special_editions'].includes(field)
))

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
