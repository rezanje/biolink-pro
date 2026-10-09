"""Verify public concierge placement; opens the dialog without sending any messages.
Run with CONCIERGE_TEST_URL pointing to a local or deployed public profile.
"""
import json
import os
from playwright.sync_api import sync_playwright, expect

url = os.environ.get('CONCIERGE_TEST_URL', 'https://my.gentanala.com/rezanje')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    try:
        for width, height in [(792, 1034), (390, 844), (1024, 600)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            page.goto(url, wait_until='networkidle')
            page.get_by_role('button', name='Ask something else', exact=True).click()
            dialog = page.get_by_role('dialog', name='AI concierge', exact=True)
            expect(dialog).to_be_visible()
            box = dialog.bounding_box()
            print(json.dumps({'viewport': [width, height], 'dialog': box}), flush=True)
            assert abs(box['x'] + box['width'] / 2 - width / 2) < 2, 'Chat is not horizontally centered'
            assert abs(box['y'] + box['height'] / 2 - height / 2) < 2, 'Chat is not vertically centered'
            assert box['y'] >= 0 and box['y'] + box['height'] <= height, 'Chat extends outside the viewport'
            send_box = page.get_by_role('button', name='Send question', exact=True).bounding_box()
            assert 0 <= send_box['y'] < send_box['y'] + send_box['height'] <= height, 'Composer is clipped'
            page.get_by_role('button', name='Close concierge', exact=True).click()
            expect(dialog).to_have_count(0)
            page.close()
    finally:
        browser.close()
