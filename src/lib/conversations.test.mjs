import assert from 'node:assert/strict'
import { orderedConversationMessages, conversationPreviews } from './conversations.mjs'
const messages = [
 { id:'a', visitor_id:'one', role:'assistant', content:'answer', created_at:'2026-10-03T10:00:00Z' },
 { id:'v', visitor_id:'one', role:'visitor', content:'question', created_at:'2026-10-03T10:00:00Z' },
 { id:'z', visitor_id:'two', role:'visitor', content:'later', created_at:'2026-10-03T11:00:00Z' },
]
assert.deepEqual(orderedConversationMessages(messages).map(m=>m.content), ['question','answer','later'])
assert.deepEqual(conversationPreviews(messages).map(([id])=>id), ['two','one'])
assert.equal(conversationPreviews(messages, 1).length, 1)
assert.equal(messages[0].id, 'a', 'sorting must not mutate caller')
