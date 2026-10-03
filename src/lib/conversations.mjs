export function orderedConversationMessages(messages) {
    return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at) ||
        (a.role === b.role ? a.id.localeCompare(b.id) : a.role === 'visitor' ? -1 : 1))
}

export function conversationPreviews(messages, limit = 12) {
    const groups = new Map()
    for (const message of orderedConversationMessages(messages)) {
        const thread = groups.get(message.visitor_id) || []
        thread.push(message)
        groups.set(message.visitor_id, thread)
    }
    return [...groups.entries()].sort((a, b) => b[1].at(-1).created_at.localeCompare(a[1].at(-1).created_at)).slice(0, limit)
}
