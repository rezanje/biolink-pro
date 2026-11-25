import { LEAD_STATUS_LABELS } from '@/lib/company-workspace.mjs'

const STATUS_TONE: Record<string, string> = {
    new: 'bg-sky/40 text-ink',
    contacted: 'bg-butter/50 text-ink',
    converted: 'bg-success-soft text-success-soft-ink',
    failed: 'bg-fill-subtle text-ink-2',
}

export function leadStatusBadge(status: string | null) {
    const key = status && STATUS_TONE[status] ? status : 'new'
    return { key, label: (LEAD_STATUS_LABELS as Record<string, string>)[key], tone: STATUS_TONE[key] }
}
