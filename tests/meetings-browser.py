"""Local integration fixture: real Next routes + browser UI, fake Supabase/Google; no live writes.
Run: python tests/meetings-browser.py [--setup-missing]
Requires Python Playwright and Chromium at /usr/bin/chromium.
"""
import base64, datetime, json, os, signal, subprocess, sys, tempfile, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
from pathlib import Path

ROOT=str(Path(__file__).resolve().parents[1])
MISSING='--setup-missing' in sys.argv
USER_ID='00000000-0000-4000-8000-000000000001'
PROFILE_ID='00000000-0000-4000-8000-000000000002'
USER={'id':USER_ID,'aud':'authenticated','role':'authenticated','email':'fixture@example.test','user_metadata':{'gentanala_ui_language':'en'},'app_metadata':{},'created_at':'2026-01-01T00:00:00Z'}
PROFILE={'id':PROFILE_ID,'user_id':USER_ID,'slug':'meeting-fixture','display_name':'Meeting Fixture','tier':'PREMIUM','role':'user','is_public':True,'theme':{},'social_links':[]}
PREFS={'profile_id':PROFILE_ID,'enabled':False,'timezone':'Asia/Jakarta','duration':30,'weekdays':[1,2,3,4,5],'start':'09:00','end':'17:00'}
TOKENS=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {encryptTokens} from './src/lib/meetings/crypto.mjs'; console.log(JSON.stringify(encryptTokens({refresh_token:'fixture-refresh'},'fixture-service')))"],cwd=ROOT))
STATE={'connection':{'user_id':USER_ID,'email':'calendar@example.test','google_account_id':'fixture-google-account','encrypted_tokens':TOKENS},'requests':[],'events':{},'busy':[],'google_calls':[]}
LOCK=threading.Lock()
def matches(row,query):
    for key,values in query.items():
        value=values[0]
        if key in ['select','order','offset','limit','on_conflict']:continue
        if value.startswith('eq.') and str(row.get(key,'')).lower()!=value[3:].lower():return False
        if value.startswith('gte.') and str(row.get(key,''))<value[4:]:return False
    return True
class Backend(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def reply(self,data,status=200,count=None):
        self.send_response(status);self.send_header('Access-Control-Allow-Origin',self.headers.get('Origin','*'))
        self.send_header('Access-Control-Allow-Headers',self.headers.get('Access-Control-Request-Headers','authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version'))
        self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,HEAD,OPTIONS');self.send_header('Content-Type','application/json')
        if count is not None:self.send_header('Content-Range',f'0-{max(0,count-1)}/{count}')
        self.end_headers()
        if self.command!='HEAD':self.wfile.write(json.dumps(data).encode())
    def read(self):
        raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
        return json.loads(raw) if raw else {}
    def do_OPTIONS(self):self.reply({})
    def do_HEAD(self):self.do_GET()
    def do_GET(self):
        parsed=urlparse(self.path);path=parsed.path;query=parse_qs(parsed.query)
        if path.startswith('/google/'):
            STATE['google_calls'].append(('GET',path))
            if path.endswith('/userinfo'):self.reply({'email':'calendar@example.test','email_verified':True,'sub':'fixture-google-account'})
            elif '/events/' in path:
                event=STATE['events'].get(path.split('/')[-1]);self.reply(event or {},200 if event else 404)
            else:self.reply({},404)
            return
        if path=='/auth/v1/user':self.reply(USER);return
        if path=='/rest/v1/profiles':rows=[PROFILE] if matches(PROFILE,query) else []
        elif path=='/rest/v1/calendar_connections':rows=[STATE['connection']] if STATE['connection'] else []
        elif path=='/rest/v1/meeting_settings':rows=[PREFS] if matches(PREFS,query) else []
        elif path=='/rest/v1/meeting_requests':rows=[row for row in STATE['requests'] if matches(row,query)];rows.sort(key=lambda r:r['created_at'],reverse=True)
        elif path=='/rest/v1/ai_concierge_settings':rows=[{'profile_id':PROFILE_ID,'enabled':True,'persona':'Fixture Concierge','knowledge':{},'suggested_actions':['Book a meeting'],'greeting':'','booking_url':'','instructions':''}]
        elif path=='/rest/v1/tier_configs':rows=[{'tier':'PREMIUM','features':{'ai_bot':True}}]
        else:rows=[]
        count=len(rows);offset=int(query.get('offset',['0'])[0]);limit=int(query.get('limit',['1000'])[0]);rows=rows[offset:offset+limit]
        self.reply(rows[0] if 'object' in self.headers.get('Accept','') and rows else rows,count=count)
    def do_POST(self):
        parsed=urlparse(self.path);path=parsed.path
        if path.startswith('/google/'):
            raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
            data=json.loads(raw) if 'application/json' in self.headers.get('Content-Type','') else parse_qs(raw.decode())
            STATE['google_calls'].append(('POST',path))
            if path.endswith('/token'):self.reply({'access_token':'fixture-access','refresh_token':'fixture-refresh','scope':'openid email https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy'})
            elif path.endswith('/freeBusy'):self.reply({'calendars':{'primary':{'busy':STATE['busy']}}})
            elif path.endswith('/events'):
                assert 'sendUpdates=all' in self.path
                if data['id'] in STATE['events']:self.reply({},409);return
                data['htmlLink']='https://www.google.com/calendar/event?eid=fixture';STATE['events'][data['id']]=data;self.reply(data)
            else:self.reply({},404)
            return
        data=self.read()
        if path=='/rest/v1/meeting_settings':PREFS.update(data);self.reply([PREFS]);return
        if path=='/rest/v1/calendar_connections':STATE['connection']=data;self.reply([data]);return
        if path=='/rest/v1/meeting_requests':
            if any(row['id']==data['id'] for row in STATE['requests']):self.reply({'code':'23505'},409);return
            data.update({'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat()});STATE['requests'].append(data);self.reply([data]);return
        if path=='/rest/v1/rpc/claim_meeting_request':
            with LOCK:
                row=next((row for row in STATE['requests'] if row['id']==data['p_request_id'] and row['profile_id']==PROFILE_ID and data['p_owner_id']==USER_ID),None)
                if not row or row['status']!='pending':self.reply([]);return
                if any(other['id']!=row['id'] and other['status'] in ['approving','approved'] and other['start_at']<row['end_at'] and other['end_at']>row['start_at'] for other in STATE['requests']):self.reply([]);return
                row.update({'status':'approving','approval_attempt':data['p_attempt'],'approval_recovery':False,'approval_calendar_account_id':data['p_calendar_account_id'],'approval_calendar_email':data['p_calendar_email']});self.reply([dict(row)])
            return
        self.reply({})
    def do_PATCH(self):
        parsed=urlparse(self.path);data=self.read();query=parse_qs(parsed.query);updated=[]
        if parsed.path=='/rest/v1/meeting_requests':
            for row in STATE['requests']:
                if matches(row,query):row.update(data);updated.append(row)
        elif parsed.path=='/rest/v1/meeting_settings':PREFS.update(data);updated=[PREFS]
        self.reply(updated)
    def do_DELETE(self):STATE['connection']=None;self.reply(None)

backend=ThreadingHTTPServer(('127.0.0.1',3111),Backend);threading.Thread(target=backend.serve_forever,daemon=True).start()
# Preload only this local test process: route Google fetches to the fake backend.
preload=tempfile.NamedTemporaryFile(mode='w',suffix='.cjs',delete=False)
preload.write("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{const s=String(url);if(/^https:\\/\\/(oauth2.googleapis.com|openidconnect.googleapis.com|www.googleapis.com)\\//.test(s)){const u=new URL(s);return original('http://127.0.0.1:3111/google'+u.pathname+u.search,options)}return original(url,options)}");preload.close()
env=os.environ.copy();env.update({'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:3111','NEXT_PUBLIC_SUPABASE_ANON_KEY':'fixture-anon','SUPABASE_SERVICE_ROLE_KEY':'fixture-service','NEXT_PUBLIC_SITE_URL':'http://127.0.0.1:3110','NODE_USE_SYSTEM_CA':'1','NODE_OPTIONS':f'--require {preload.name}'})
if not MISSING:env.update({'GOOGLE_CALENDAR_CLIENT_ID':'fixture-client','GOOGLE_CALENDAR_CLIENT_SECRET':'fixture-secret'})
else:
    env.pop('GOOGLE_CALENDAR_CLIENT_ID',None);env.pop('GOOGLE_CALENDAR_CLIENT_SECRET',None)
log=open('/tmp/meetings-browser.log','w')
server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3110'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
def enc(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':USER_ID,'aud':'authenticated','exp':int(time.time())+3600})+'.fixture'
session={'access_token':token,'refresh_token':'fixture-refresh','token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':USER}
try:
    for _ in range(100):
        try:urllib.request.urlopen('http://127.0.0.1:3110/favicon.ico',timeout=2);break
        except Exception:time.sleep(.5)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        owner=browser.new_context(viewport={'width':390,'height':844});owner.add_cookies([{'name':'sb-127-auth-token','value':'base64-'+enc(session),'domain':'127.0.0.1','path':'/','sameSite':'Lax'}])
        page=owner.new_page();page.set_default_timeout(30000);expect.set_options(timeout=15000)
        page.goto('http://127.0.0.1:3110/dashboard/ai-assistant',timeout=90000)
        section=page.locator('#meeting-settings')
        if MISSING:
            expect(section.get_by_text('Calendar booking is not available yet. You can still use a booking link above.',exact=True)).to_be_visible()
            expect(section.get_by_role('switch')).to_be_disabled()
            assert owner.request.get('http://127.0.0.1:3110/api/calendar').json()['configured'] is False
            assert owner.request.get('http://127.0.0.1:3110/api/meetings?slug=meeting-fixture').json()=={'enabled':False}
            assert not STATE['events'];print('PASS: missing OAuth setup is honest, disabled, and hides public booking',flush=True)
        else:
            expect(section.get_by_text('calendar@example.test',exact=True)).to_be_visible()
            # Exercise real OAuth route state/PKCE binding without contacting Google.
            connect=owner.request.get('http://127.0.0.1:3110/api/calendar/connect',max_redirects=0)
            assert connect.status==307,connect.status
            query=parse_qs(urlparse(connect.headers['location']).query);nonce=query['state'][0]
            cookie=next(c['value'] for c in owner.cookies() if c['name']=='gentanala-calendar-state')
            assert nonce!=cookie and 'verifier' not in nonce
            callback=owner.request.get('http://127.0.0.1:3110/api/calendar/callback?'+f'state={nonce}&code=fixture',max_redirects=0)
            assert callback.headers['location'].endswith('calendar=connected'),callback.headers
            assert 'fixture-refresh' not in json.dumps(STATE['connection']['encrypted_tokens'])
            assert 'encrypted_tokens' not in owner.request.get('http://127.0.0.1:3110/api/calendar').text()
            section.get_by_role('switch').click();section.get_by_role('button',name='Save meeting settings',exact=True).click()
            expect(section.get_by_text('Meeting settings saved.',exact=True)).to_be_visible();assert PREFS['enabled']
            assert not STATE['events'];print('PASS: owner OAuth connects with encrypted credentials, settings enable booking without events',flush=True)
            # Next weekday in Jakarta within the horizon.
            date=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=7)).date()+datetime.timedelta(days=1)
            while date.weekday()>4:date+=datetime.timedelta(days=1)
            first=f'{date.isoformat()}T02:00:00.000Z';end=f'{date.isoformat()}T02:30:00.000Z';STATE['busy']=[{'start':first,'end':end}]
            visitor=browser.new_context(viewport={'width':390,'height':844});public=visitor.new_page();public.set_default_timeout(30000)
            public.goto('http://127.0.0.1:3110/meeting-fixture',timeout=90000)
            # Wait for the public enabled status before selecting the shortcut.
            public.wait_for_function("async()=>{const r=await fetch('/api/meetings?slug=meeting-fixture');return (await r.json()).enabled}")
            time.sleep(.3)
            public.get_by_role('button',name='Book a meeting',exact=True).click()
            dialog=public.get_by_role('dialog',name='Book a meeting',exact=True)
            expect(dialog).to_be_visible();dialog.get_by_label('Meeting date',exact=True).fill(date.isoformat())
            expect(dialog.locator('input[type=radio]')).not_to_have_count(0)
            dialog.locator('input[type=radio]').first.locator('..').click()
            selected=dialog.locator('input[type=radio]:checked').input_value();assert selected!=first
            dialog.get_by_label('Your name',exact=True).fill('Alice Visitor');dialog.get_by_label('Email for calendar invitation',exact=True).fill('alice@example.test')
            dialog.get_by_label('Meeting note, optional',exact=True).fill('Discuss collaboration')
            dialog.get_by_role('button',name='Request meeting',exact=True).click()
            expect(dialog.get_by_text('Request sent — awaiting approval',exact=True)).to_be_visible()
            assert len(STATE['requests'])==1 and STATE['requests'][0]['status']=='pending';assert not STATE['events']
            public.screenshot(path='/tmp/meeting-request-mobile.png');dialog.get_by_role('button',name='Done',exact=True).click()
            row=STATE['requests'][0]
            retry=visitor.request.post('http://127.0.0.1:3110/api/meetings',headers={'Origin':'http://127.0.0.1:3110'},data={'slug':'meeting-fixture','name':'Alice Visitor','email':'alice@example.test','start':row['start_at'],'requestId':row['id']})
            assert retry.status==200 and len(STATE['requests'])==1;assert not STATE['events']
            print('PASS: busy slots hidden; visitor submits pending request; retry creates no duplicate or invitation',flush=True)
            # A different owner's row cannot be handled through the authenticated API.
            other={**row,'id':'00000000-0000-4000-8000-000000000099','profile_id':'00000000-0000-4000-8000-000000000098'};STATE['requests'].append(other)
            denied=owner.request.patch('http://127.0.0.1:3110/api/meetings/requests',headers={'Origin':'http://127.0.0.1:3110'},data={'id':other['id'],'action':'approve'})
            assert denied.status==404;STATE['requests'].remove(other)
            origin=owner.request.patch('http://127.0.0.1:3110/api/meetings/requests',headers={'Origin':'https://wrong.example'},data={'id':row['id'],'action':'approve'});assert origin.status==403
            unauthorized=visitor.request.patch('http://127.0.0.1:3110/api/meetings/requests',headers={'Origin':'http://127.0.0.1:3110'},data={'id':row['id'],'action':'approve'});assert unauthorized.status==401
            page.reload();expect(section.get_by_text('Alice Visitor',exact=True)).to_be_visible()
            section.get_by_role('button',name='Accept request from Alice Visitor',exact=True).click()
            expect(section.get_by_text('Meeting accepted. Google Calendar invitations have been sent.',exact=True)).to_be_visible()
            assert row['status']=='approved' and len(STATE['events'])==1
            event=next(iter(STATE['events'].values()));assert event['attendees']==[{'email':'alice@example.test'}]
            accepted=owner.request.patch('http://127.0.0.1:3110/api/meetings/requests',headers={'Origin':'http://127.0.0.1:3110'},data={'id':row['id'],'action':'approve'});assert accepted.status==200 and len(STATE['events'])==1
            uncertain={**row,'id':'00000000-0000-4000-8000-000000000066','status':'approving','approval_calendar_account_id':'original-other-account'};STATE['requests'].append(uncertain)
            wrong_calendar=owner.request.patch('http://127.0.0.1:3110/api/meetings/requests',headers={'Origin':'http://127.0.0.1:3110'},data={'id':uncertain['id'],'action':'approve'})
            assert wrong_calendar.status==409 and 'original Google account' in wrong_calendar.json()['error'] and len(STATE['events'])==1
            STATE['requests'].remove(uncertain)
            declined={**row,'id':'00000000-0000-4000-8000-000000000077','visitor_name':'Bob Visitor','status':'pending','start_at':f'{date.isoformat()}T04:00:00.000Z','end_at':f'{date.isoformat()}T04:30:00.000Z'};STATE['requests'].append(declined)
            page.reload();section.get_by_role('button',name='Decline request from Bob Visitor',exact=True).click();expect(section.get_by_text('Meeting request declined.',exact=True)).to_be_visible()
            assert declined['status']=='rejected' and len(STATE['events'])==1
            page.screenshot(path='/tmp/meeting-owner-mobile.png')
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            print('PASS: owner-scoped acceptance creates one invited event, repeated approval is idempotent, decline creates no event; mobile fits',flush=True)
            section.get_by_role('button',name='Disconnect',exact=True).click();expect(section.get_by_text('Google Calendar disconnected.',exact=True)).to_be_visible()
            assert STATE['connection'] is None and PREFS['enabled'] is False
            assert owner.request.get('http://127.0.0.1:3110/api/meetings?slug=meeting-fixture').json()=={'enabled':False}
            print('PASS: disconnect disables new meeting requests',flush=True)
        browser.close()
finally:
    os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10);backend.shutdown();log.close();os.unlink(preload.name)
