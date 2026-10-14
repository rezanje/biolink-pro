const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
const origin = process.env.NOTIFICATION_TEST_ORIGIN || 'http://localhost:3005'
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/)
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']})
const context = await browser.newContext({viewport:{width:390,height:844}})
const owner = '10000000-0000-0000-0000-000000000002'
const profile = '20000000-0000-0000-0000-000000000004'
const user = {id:owner,aud:'authenticated',role:'authenticated',email:'owner@example.test',user_metadata:{gentanala_ui_language:'id'},app_metadata:{},created_at:new Date().toISOString()}
const token = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test'
const session = {access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}
await context.addCookies([{name:'sb-notifications-test-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'localhost',path:'/'}])
let mode='normal', saves=[], reads=[], loadCount=0
const rows = [{id:'40000000-0000-0000-0000-000000000001',created_at:'2026-10-14T12:00:00Z',read_at:null,actor_profile_id:profile,actor_slug:'saver-public',actor_name:'Saver',is_saved:false}]
await context.route('https://notifications-test.supabase.co/**', async route => {
 const req=route.request(), url=new URL(req.url())
 let status=200, body=[], headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'content-range'}
 if(req.method()==='OPTIONS') return route.fulfill({status:200,headers,body:''})
 if(url.pathname==='/auth/v1/user') body=user
 else if(url.pathname==='/rest/v1/profiles') body={tier:'FREE'}
 else if(url.pathname==='/rest/v1/rpc/list_card_save_notifications') {
  loadCount++
  if(mode==='load-failure') {status=500;body={message:'Injected load failure'}}
  else if(mode==='private') body=[{...rows[0],actor_profile_id:null,actor_slug:null,actor_name:null}]
  else if(mode==='empty') body=[]
  else body=rows
 } else if(url.pathname==='/rest/v1/saved_profiles') {
  saves.push(req.postDataJSON())
  if(mode==='save-failure') {status=403;body={message:'Private now'}}
  else {status=201;body=null}
 } else if(url.pathname==='/rest/v1/card_save_notifications') {
  if(req.method()==='PATCH') {
   reads.push(req.postDataJSON()); body={id:rows[0].id}
   if(mode==='read-failure') {status=500;body={message:'Injected read failure'}}
  } else {headers['content-range']='0-0/'+(reads.length ? '0' : '1');body=null}
 }
 await route.fulfill({status,headers,body:body===null?'':JSON.stringify(body)})
})
const page=await context.newPage()
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.goto(origin + '/dashboard/notifications')
await page.getByRole('heading',{name:'Notifikasi',exact:true}).waitFor()
await page.getByText('Saver menyimpan kartu lo.').waitFor()
assert.equal(saves.length,0,'No automatic reciprocal save')
assert.equal(await page.getByRole('link',{name:'Lihat kartu',exact:true}).getAttribute('href'),'/saver-public')
await page.getByRole('link',{name:'Notifikasi',exact:true}).getByText('1',{exact:true}).waitFor()
await page.screenshot({path:'/tmp/biolink-notifications-mobile.png',fullPage:true})
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow')
await page.getByRole('button',{name:'Simpan balik',exact:true}).click()
await page.getByRole('button',{name:'Sudah tersimpan',exact:true}).waitFor()
assert.deepEqual(saves,[{user_id:owner,profile_id:profile}])
await page.getByRole('button',{name:'Tandai sudah dibaca',exact:true}).waitFor({state:'hidden'})
assert.equal(reads.length,1)
assert.equal(await page.getByRole('button',{name:'Sudah tersimpan',exact:true}).isDisabled(),true)
mode='save-failure';await page.getByRole('button',{name:'Perbarui notifikasi'}).click()
await page.getByRole('button',{name:'Simpan balik',exact:true}).click()
await page.getByRole('alert').filter({hasText:'Kartu gagal disimpan'}).waitFor()
assert.equal(await page.getByRole('button',{name:'Simpan balik',exact:true}).isEnabled(),true)
mode='read-failure';await page.getByRole('button',{name:'Simpan balik',exact:true}).click()
await page.getByRole('button',{name:'Sudah tersimpan',exact:true}).waitFor()
await page.getByRole('alert').filter({hasText:'Notifikasi gagal diperbarui'}).waitFor()
mode='private';await page.getByRole('button',{name:'Perbarui notifikasi'}).click()
await page.getByText('Anggota ini belum punya kartu publik yang tersedia.').waitFor()
assert.equal(await page.getByRole('button',{name:'Simpan balik',exact:true}).count(),0)
assert.equal(await page.getByRole('link',{name:'Lihat kartu',exact:true}).count(),0)
mode='load-failure';await page.getByRole('button',{name:'Perbarui notifikasi'}).click()
await page.getByRole('alert').filter({hasText:'Notifikasi gagal dimuat'}).waitFor()
mode='empty';await page.getByRole('button',{name:'Perbarui notifikasi'}).click()
await page.getByText('Belum ada yang menyimpan kartu lo.').waitFor()
mode='normal';await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Perbarui notifikasi'}).click()
await page.getByText('Saver menyimpan kartu lo.').waitFor()
await page.screenshot({path:'/tmp/biolink-notifications-desktop.png',fullPage:true})
assert.equal(errors.length,0,errors.join('\n'))
assert.ok(loadCount>=7)
console.log('PASS: mobile/desktop inbox, public card link, optional save payload, duplicate prevention, save/read/load failures, private/missing profile fallback, empty state, Indonesian labels; no runtime errors.')
await browser.close()
