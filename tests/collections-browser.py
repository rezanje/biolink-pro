"""Real dashboard UI with a local Supabase fixture; never write live data.

Run: python tests/collections-browser.py
Requires Python Playwright and /usr/bin/chromium, like meetings-browser.py.
"""
import base64
import json
import os
import re
import signal
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = 'http://127.0.0.1:3130'
USER_ID = '00000000-0000-4000-8000-000000000001'
CLIENTS = '00000000-0000-4000-8000-000000000010'
FRIENDS = '00000000-0000-4000-8000-000000000011'
USER = {'id': USER_ID, 'aud': 'authenticated', 'role': 'authenticated',
        'email': 'fixture@example.test', 'user_metadata': {'gentanala_ui_language': 'en'},
        'app_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
STATE = {'tier': 'PREMIUM', 'cards': []}
FOLDERS = [{'id': CLIENTS, 'user_id': USER_ID, 'name': 'Clients', 'created_at': '2026-01-01'},
           {'id': FRIENDS, 'user_id': USER_ID, 'name': 'Friends', 'created_at': '2026-01-02'}]
LEADS = [{'id': str(i), 'name': f'Lead fixture {i}', 'profile_id': USER_ID,
          'status': 'new', 'company': 'Fixture company', 'whatsapp': '',
          'created_at': f'2026-01-{10-i:02d}T00:00:00Z'} for i in range(1, 9)]


def reset_cards():
    STATE['cards'] = [
        {'user_id': USER_ID, 'profile_id': str(i), 'folder_id': folder,
         'created_at': '2026-01-01T00:00:00Z',
         'profile': {'slug': f'fixture-{i}', 'display_name': name, 'company': None,
                     'job_title': None, 'avatar_url': None}}
        for i, folder, name in [(1, CLIENTS, 'Client card'), (2, None, 'Unfiled card')]
    ]


class Backend(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, rows, count=None):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', '*'))
        self.send_header('Access-Control-Allow-Headers', self.headers.get('Access-Control-Request-Headers', '*'))
        self.send_header('Access-Control-Allow-Methods', 'GET,HEAD,PATCH,OPTIONS')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range')
        if count is not None:
            self.send_header('Content-Range', f'0-{max(0, count-1)}/{count}')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(json.dumps(rows).encode())

    def do_OPTIONS(self):
        self.reply({})

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = urlparse(self.path).path
        query = parse_qs(urlparse(self.path).query)
        if path == '/auth/v1/user':
            self.reply(USER)
            return
        if path == '/rest/v1/profiles':
            rows = [{'id': USER_ID, 'user_id': USER_ID, 'slug': 'fixture',
                     'display_name': 'Fixture', 'tier': STATE['tier'], 'role': 'user'}]
        elif path == '/rest/v1/tier_configs':
            rows = [{'tier': tier, 'features': {'analytics_leads': tier != 'FREE'}}
                    for tier in ['FREE', 'PREMIUM', 'B2B']]
        elif path == '/rest/v1/card_folders':
            rows = FOLDERS
        elif path == '/rest/v1/saved_profiles':
            rows = STATE['cards']
        elif path == '/rest/v1/leads':
            rows = LEADS[:]
            if 'or' in query:
                search = re.search(r'name\.ilike\.%([^%]*)%', query['or'][0]).group(1)
                rows = [row for row in rows if search.lower() in row['name'].lower()]
            rows.sort(key=lambda row: row['created_at'], reverse=query.get('order', [''])[0].endswith('.desc'))
        else:
            rows = []
        self.reply(rows[0] if rows and 'object' in self.headers.get('Accept', '') else rows, len(rows))

    def do_PATCH(self):
        query = parse_qs(urlparse(self.path).query)
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        rows = [row for row in STATE['cards'] if query.get('profile_id') == ['eq.' + row['profile_id']]]
        for row in rows:
            row.update(data)
        self.reply(rows[0] if rows and 'object' in self.headers.get('Accept', '') else rows)


def enc(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')


def folder_flow(page):
    reset_cards()
    page.goto(SITE + '/dashboard/analytics')
    collection = page.locator('#saved')
    expect(collection.get_by_role('button', name='Open folder Clients', exact=True)).to_be_visible()
    expect(collection.get_by_text('Client card', exact=True)).not_to_be_visible()
    expect(collection.get_by_text('Unfiled card', exact=True)).not_to_be_visible()
    collection.get_by_role('button', name='Open folder Clients', exact=True).click()
    expect(collection.get_by_text('Client card', exact=True)).to_be_visible()
    expect(collection.get_by_text('Unfiled card', exact=True)).not_to_be_visible()
    collection.get_by_role('combobox', name='Folder for Client card').select_option(FRIENDS)
    expect(collection.get_by_text('Client card', exact=True)).not_to_be_visible()
    collection.get_by_role('button', name='Open folder Friends', exact=True).click()
    expect(collection.get_by_text('Client card', exact=True)).to_be_visible()
    expect(collection.get_by_role('combobox', name='Folder for Client card')).to_have_value(FRIENDS)
    collection.get_by_role('button', name='Back to folders', exact=True).click()
    expect(collection.get_by_text('Client card', exact=True)).not_to_be_visible()
    collection.get_by_role('button', name='Open folder Unfiled', exact=True).click()
    expect(collection.get_by_text('Unfiled card', exact=True)).to_be_visible()
    page.goto(SITE + '/dashboard/saved')
    expect(page.get_by_role('button', name='Open folder Friends', exact=True)).to_be_visible()
    expect(page.get_by_text('Client card', exact=True)).not_to_be_visible()


def leads_flow(page):
    page.goto(SITE + '/dashboard/analytics')
    rows = page.locator('[role="button"]').filter(has_text=re.compile('Lead fixture'))
    expect(rows.first).to_be_visible()
    expect(rows).to_have_count(5)
    expand = page.get_by_role('button', name='Expand leads (3 more)', exact=True)
    expect(expand).to_have_attribute('aria-expanded', 'false')
    expand.click()
    expect(rows).to_have_count(8)
    collapse = page.get_by_role('button', name='Collapse leads', exact=True)
    expect(collapse).to_have_attribute('aria-expanded', 'true')
    collapse.click()
    expect(rows).to_have_count(5)
    expand.click()
    page.get_by_role('button', name='Newest', exact=True).click()
    expect(rows).to_have_count(5)
    expect(expand).to_be_visible()
    search = page.get_by_placeholder('Name, company, phone, email')
    search.fill('Lead fixture 8')
    expect(rows).to_have_count(1)
    expect(expand).not_to_be_visible()
    search.fill('missing lead')
    expect(page.get_by_role('heading', name='No contacts yet', exact=True)).to_be_visible()
    expect(rows).to_have_count(0)
    expect(page.get_by_role('button', name='Collapse leads', exact=True)).not_to_be_visible()
    expect(page.get_by_role('heading', name='Traffic', exact=True)).to_be_visible()


backend = ThreadingHTTPServer(('127.0.0.1', 3131), Backend)
threading.Thread(target=backend.serve_forever, daemon=True).start()
env = os.environ.copy()
env.update({'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:3131',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'fixture-anon', 'SUPABASE_SERVICE_ROLE_KEY': 'fixture-service',
            'NEXT_PUBLIC_SITE_URL': SITE, 'NODE_USE_SYSTEM_CA': '1'})
log = open('/tmp/collections-browser.log', 'w')
server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'dev', '--webpack',
                           '--hostname', '127.0.0.1', '--port', '3130'],
                          cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
failures = []
try:
    for attempt in range(100):
        try:
            urllib.request.urlopen(SITE + '/favicon.ico', timeout=2)
            break
        except Exception:
            if server.poll() is not None:
                raise RuntimeError('Next server failed; see /tmp/collections-browser.log')
            time.sleep(.5)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width in [390, 1280]:
            context = browser.new_context(viewport={'width': width, 'height': 844})
            token = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'sub': USER_ID, 'exp': int(time.time())+3600}) + '.fixture'
            session = {'access_token': token, 'refresh_token': 'fixture-refresh', 'token_type': 'bearer',
                       'expires_in': 3600, 'expires_at': int(time.time())+3600, 'user': USER}
            context.add_cookies([{'name': 'sb-127-auth-token', 'value': 'base64-'+enc(session),
                                 'domain': '127.0.0.1', 'path': '/', 'sameSite': 'Lax'}])
            page = context.new_page()
            page.set_default_timeout(30000)
            expect.set_options(timeout=10000)
            for flow in [folder_flow, leads_flow]:
                STATE['tier'] = 'PREMIUM'
                try:
                    flow(page)
                    print(f'PASS {flow.__name__} viewport={width}', flush=True)
                except Exception as error:
                    failures.append(f'{flow.__name__} viewport={width}: {error}')
                    print('FAIL ' + failures[-1], flush=True)
            STATE['tier'] = 'FREE'
            try:
                folder_flow(page)
                page.goto(SITE + '/dashboard/analytics')
                expect(page.get_by_role('heading', name='Premium feature', exact=True)).to_be_visible()
                print(f'PASS free collection with retained leads gate viewport={width}', flush=True)
            except Exception as error:
                failures.append(f'free collection viewport={width}: {error}')
                print('FAIL ' + failures[-1], flush=True)
            context.close()
        browser.close()
finally:
    os.killpg(server.pid, signal.SIGTERM)
    server.wait(timeout=10)
    backend.shutdown()
    log.close()
if failures:
    raise SystemExit(f'{len(failures)} browser checks failed')
