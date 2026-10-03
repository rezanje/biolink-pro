import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizePreferences, slotsForDay, availableSlots, normalizeRequest } from './policy.mjs'
import { encryptTokens, decryptTokens, createOAuthState, readOAuthState } from './crypto.mjs'
import { authorizationUrl, ensureCalendarEvent } from './google-calendar.mjs'
import { approveBooking } from './approval.mjs'
const prefs = { enabled:true, timezone:'Asia/Jakarta', duration:30, weekdays:[1,2,3,4,5], start:'09:00', end:'17:00' }
test('preferences reject invalid timezones/hours/duration',()=>{
 assert.throws(()=>normalizePreferences({...prefs,timezone:'moon'}))
 assert.throws(()=>normalizePreferences({...prefs,end:'08:00'}))
 assert.throws(()=>normalizePreferences({...prefs,duration:45}))
 assert.equal(normalizePreferences(prefs).timezone,'Asia/Jakarta')
})
test('slots use local timezone, notice, weekdays and horizon',()=>{
 const slots=slotsForDay('2026-10-05',prefs,new Date('2026-10-04T00:00:00Z'))
 assert.equal(slots[0].start,'2026-10-05T02:00:00.000Z'); assert.equal(slots.length,16)
 assert.equal(slotsForDay('2026-10-04',prefs,new Date('2026-10-03T00:00:00Z')).length,0)
 assert.equal(slotsForDay('2026-10-25',prefs,new Date('2026-10-03T00:00:00Z')).length,0)
 assert.equal(slotsForDay('2026-10-05',prefs,new Date('2026-10-05T01:15:00Z'))[0].start,'2026-10-05T03:30:00.000Z')
 assert.throws(()=>slotsForDay('2026-02-30',prefs))
})
test('DST gap and fold have valid nonduplicated local times',()=>{
 const local={...prefs,timezone:'America/New_York',weekdays:[7],start:'01:00',end:'04:00'}
 const spring=slotsForDay('2027-03-14',local,new Date('2027-03-13T00:00:00Z'))
 assert.equal(spring.length,4); assert.equal(spring[0].start,'2027-03-14T06:00:00.000Z')
 const autumn=slotsForDay('2026-11-01',local,new Date('2026-10-31T00:00:00Z'))
 assert.equal(new Set(autumn.map(s=>s.start)).size,autumn.length)
})
test('busy filtering handles overlap but permits adjoining events',()=>{
 const slots=slotsForDay('2026-10-05',prefs,new Date('2026-10-04T00:00:00Z'))
 assert.equal(availableSlots(slots,[{start:slots[0].start,end:slots[0].end}])[0].start,slots[1].start)
})
test('request validates contact and does not accept arbitrary dates',()=>{
 assert.throws(()=>normalizeRequest({name:'A',email:'bad',start:'bad'}))
 const value=normalizeRequest({name:' Alice ',email:'ALICE@example.com',start:'2026-10-05T02:00:00Z',note:'Hello'})
 assert.equal(value.email,'alice@example.com');assert.equal(value.name,'Alice')
})
test('encrypted tokens and OAuth state authenticate owner and expire',()=>{
 const value={refresh_token:'private',access_token:'secret'}; const encrypted=encryptTokens(value,'key')
 assert.ok(!JSON.stringify(encrypted).includes('private'));assert.deepEqual(decryptTokens(encrypted,'key'),value)
 assert.throws(()=>decryptTokens(encrypted,'other'))
 const state=createOAuthState('owner','key',1000)
 assert.equal(readOAuthState(state,'key','owner',1001).userId,'owner')
 assert.throws(()=>readOAuthState(state,'key','other',1001));assert.throws(()=>readOAuthState(state,'key','owner',1601))
})
test('OAuth asks for offline consent and PKCE',()=>{
 const url=new URL(authorizationUrl({clientId:'id',redirectUri:'https://example.com/callback',state:'state',verifier:'verifier'}))
 assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256')
 assert.ok(url.searchParams.get('scope').includes('calendar.events.owned'))
})
test('approval retries reuse event ID and send invites only when inserting approved event',async()=>{
 const booking={id:'request-id',visitor_name:'Alice',visitor_email:'alice@example.com',start_at:'2026-10-05T02:00:00Z',end_at:'2026-10-05T02:30:00Z',timezone:'Asia/Jakarta'}
 const calls=[]; let stored
 const fetcher=async(url,options={})=>{
  calls.push([url,options]);
  if(options.method==='POST'){ stored=JSON.parse(options.body);return new Response(JSON.stringify(stored),{status:200}) }
  return new Response(JSON.stringify(stored||{}),{status:stored?200:404})
 }
 const first=await ensureCalendarEvent('token',booking,fetcher)
 const second=await ensureCalendarEvent('token',booking,fetcher)
 assert.equal(first.id,second.id);assert.equal(calls.filter(([,o])=>o.method==='POST').length,1)
 assert.equal(stored.attendees[0].email,'alice@example.com');assert.ok(calls.find(([u,o])=>o.method==='POST'&&u.includes('sendUpdates=all')))
})
test('approval claims once, rejects busy times, rolls back retryable failure',async()=>{
 let status='pending';let events=0
 const booking={id:'b',start_at:new Date(Date.now()+86400000).toISOString(),end_at:new Date(Date.now()+88200000).toISOString()}
 const store={claim:async()=>{if(status!=='pending')return null;status='approving';return booking},finish:async()=>{status='approved'},release:async()=>{status='pending'}}
 const calendar={existing:async()=>null,busy:async()=>[],insert:async()=>{events++;return {id:'event'}}}
 await Promise.allSettled([approveBooking(store,calendar),approveBooking(store,calendar)])
 assert.equal(status,'approved');assert.equal(events,1)
 status='pending'; calendar.busy=async()=>[{start:booking.start_at,end:booking.end_at}]
 await assert.rejects(()=>approveBooking(store,calendar),/busy/);assert.equal(status,'pending');assert.equal(events,1)
 calendar.busy=async()=>[];calendar.busy=async()=>{throw new Error('Google unavailable')}
 await assert.rejects(()=>approveBooking(store,calendar));assert.equal(status,'pending')
})
test('an uncertain Google write or failed confirmation cannot become rejectable pending',async()=>{
 let status='pending';const booking={id:'b',start_at:new Date(Date.now()+86400000).toISOString(),end_at:new Date(Date.now()+88200000).toISOString()}
 const store={claim:async()=>{status='approving';return booking},finish:async()=>{throw new Error('Database timeout')},release:async()=>{status='pending'}}
 const calendar={existing:async()=>null,busy:async()=>[],insert:async()=>({id:'event'})}
 await assert.rejects(()=>approveBooking(store,calendar));assert.equal(status,'approving')
 status='pending';calendar.insert=async()=>{throw new Error('Network timeout after submission')}
 await assert.rejects(()=>approveBooking(store,calendar));assert.equal(status,'approving')
})
test('OAuth refuses missing refresh token and partially granted Calendar scope',async()=>{
 const { exchangeCode }=await import('./google-calendar.mjs')
 const config={code:'code',verifier:'verifier',clientId:'client',clientSecret:'secret',redirectUri:'https://example.com/callback'}
 await assert.rejects(()=>exchangeCode(config,async()=>new Response(JSON.stringify({access_token:'access',scope:'openid email'}))),/permissions/)
 await assert.rejects(()=>exchangeCode(config,async()=>new Response(JSON.stringify({access_token:'access',refresh_token:'refresh',scope:'openid email https://www.googleapis.com/auth/calendar.freebusy'}))),/permissions/)
})
test('busy lookup fails closed when Google cannot report calendar availability',async()=>{
 const { calendarBusy }=await import('./google-calendar.mjs')
 await assert.rejects(()=>calendarBusy('token','2026-10-05T02:00:00Z','2026-10-05T02:30:00Z',async()=>new Response(JSON.stringify({calendars:{primary:{errors:[{reason:'forbidden'}]}}}))),/availability/)
})
test('retry cannot create an invitation after switching Google accounts',async()=>{
 let calls=0;let released=false
 const booking={id:'b',approval_recovery:true,approval_calendar_account_id:'google-account-A',start_at:new Date(Date.now()+86400000).toISOString()}
 const store={claim:async()=>booking,finish:async()=>{},release:async()=>{released=true}}
 const calendar={accountId:'google-account-B',existing:async()=>{calls++;return null},busy:async()=>[],insert:async()=>{calls++;return {id:'new-event'}}}
 await assert.rejects(()=>approveBooking(store,calendar),/original Google account/)
 assert.equal(calls,0);assert.equal(released,false)
})
test('DST rollback validates every instant and offers the valid repeated wall time',()=>{
 const preferences={...prefs,timezone:'America/New_York',weekdays:[7],start:'01:30',end:'02:30',duration:60}
 const slots=slotsForDay('2026-11-01',preferences,new Date('2026-10-31T00:00:00Z'))
 assert.deepEqual(slots,[{start:'2026-11-01T06:30:00.000Z',end:'2026-11-01T07:30:00.000Z'}])
})
test('fresh read-only failure releases request; an uncertain recovery stays protected',async()=>{
 for(const recovery of [false,true]){
  let status='approving'
  const store={claim:async()=>({id:'b',approval_recovery:recovery}),finish:async()=>{},release:async()=>{status='pending'}}
  const calendar={existing:async()=>{throw new Error('Read timeout')}}
  await assert.rejects(()=>approveBooking(store,calendar))
  assert.equal(status,recovery?'approving':'pending')
 }
})
