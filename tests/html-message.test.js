import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createHtmlMessage, sanitizedMessage, safeMessageUrl } from '../src/popup/html-message.js';
const document = parseHTML('<html></html>').document;
const body = result => parseHTML(result.html).document;

test('formatted email preserves headings, inline colours, tables and links', () => {
  const result = sanitizedMessage('<h2 style="color:#123456;font-size:20px">News</h2><table cellpadding="4"><tr><td><b>Item</b></td><td>Value</td></tr></table><a href="https://example.test/news">Read more</a>', document);
  const parsed = body(result);
  assert.equal(parsed.querySelector('h2').textContent, 'News');
  assert.equal(parsed.querySelector('h2').getAttribute('style'), 'color:#123456;font-size:20px');
  assert.equal(parsed.querySelectorAll('td').length, 2);
  assert.equal(parsed.querySelector('a').getAttribute('href'), 'https://example.test/news');
  assert.equal(parsed.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
});

test('email scripts, forms, navigation, event handlers and CSS network requests are removed', () => {
  const content = '<script>alert(1)</script><style>@import "https://example.test/track";</style><base href="https://example.test"><meta http-equiv="refresh" content="0;url=https://example.test"><iframe srcdoc="unsafe"></iframe><object data="https://example.test"></object><svg onload="evil()"><foreignObject>unsafe</foreignObject></svg><form action="https://example.test"><input name="token"></form><div id="app" onclick="evil()" style="color:red;background-image:url(https://example.test);position:fixed;width:expression(evil());border-image:url(https://example.test)"><a href="javascript:evil()" target="_top" ping="https://example.test">Safe text</a></div>';
  const result = sanitizedMessage(content, document);
  const parsed = body(result);
  assert.equal(parsed.querySelector('script,form,iframe,object,svg,input,base'), null);
  assert.equal(parsed.querySelector('div').getAttribute('onclick'), null);
  assert.equal(parsed.querySelector('div').getAttribute('id'), null);
  assert.equal(parsed.querySelector('div').getAttribute('style'), 'color:red');
  assert.equal(parsed.querySelector('a').getAttribute('href'), null);
  assert.equal(parsed.querySelector('a').getAttribute('target'), null);
  assert.equal(parsed.querySelector('a').getAttribute('ping'), null);
  assert.match(parsed.querySelector('meta[http-equiv]').getAttribute('content'), /script-src 'none'/);
  assert.equal(result.html.includes('evil()'), false);
});

test('credential-free HTTPS images load automatically while unsupported images remain placeholders', () => {
  const content = '<img src="https://example.test/photo.png" srcset="https://example.test/other.png 2x" onerror="evil()" alt="Photo"><img src="cid:attachment" alt="Logo"><img src="http://example.test/insecure"><img src="data:image/svg+xml,unsafe"><img src="https://user:secret@example.test/tracker.png" alt="Tracker">';
  const result = sanitizedMessage(content, document);
  const parsed = body(result);
  const images = parsed.querySelectorAll('img');
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), 'https://example.test/photo.png');
  assert.equal(images[0].getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(images[0].getAttribute('srcset'), null);
  assert.equal(images[0].getAttribute('onerror'), null);
  assert.equal(parsed.querySelectorAll('.image-placeholder').length, 4);
  assert.deepEqual(Array.from(parsed.querySelectorAll('.image-placeholder'), placeholder => placeholder.textContent), [
    'Logo', 'Image available in mailbox', 'Image available in mailbox', 'Tracker',
  ]);
  assert.match(result.html, /img-src https:/);
  assert.match(result.html, /script-src 'none'/);
  assert.match(result.html, /<meta name="referrer" content="no-referrer">/);
  assert.equal(result.html.includes('user:secret'), false);
});

test('link URLs must be absolute HTTP(S) without credentials', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', 'file:///tmp/file', 'chrome-extension://id/page', 'https://user:pass@example.test', '/relative', '#fragment', null]) assert.equal(safeMessageUrl(value), null);
  assert.equal(safeMessageUrl('https://example.test/path?q=1'), 'https://example.test/path?q=1');
});

test('encoded URLs and malformed markup cannot escape the sanitized document', () => {
  const result = sanitizedMessage('<a href="&#106;avascript:evil()">Link</a><img src="https://example.test/a&quot; onerror=&quot;evil()"><div style="background-color:red; color: u\\72l(https://example.test)">Text</div><!-- unsafe comment --><math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=evil()>">', document);
  const parsed = body(result);
  assert.equal(parsed.querySelector('a').getAttribute('href'), null);
  assert.equal(parsed.querySelector('[onerror],script,math'), null);
  assert.equal(parsed.querySelector('div').getAttribute('style'), 'background-color:red');
});

test('formatted reader reports wheel, scroll and keyboard activity', () => {
  const { window } = parseHTML('<html></html>');
  const readings = [];
  const previousResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    const container = createHtmlMessage('<p>Reader</p>', window.document, {
      onReading: input => readings.push(input),
    });
    const frame = container.querySelector('iframe');
    const inner = parseHTML(frame.srcdoc).document;
    inner.body.getBoundingClientRect = () => ({ height: 20 });
    Object.defineProperty(inner.body, 'scrollHeight', { value: 20 });
    Object.defineProperty(frame, 'contentDocument', { configurable: true, value: inner });
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true, value: { addEventListener() {} },
    });
    frame.dispatchEvent(new window.Event('load'));
    inner.dispatchEvent(new window.Event('wheel'));
    inner.dispatchEvent(new window.Event('scroll'));
    const keyboard = new window.Event('keydown');
    keyboard.key = 'ArrowDown';
    inner.dispatchEvent(keyboard);
    assert.deepEqual(readings, ['pointer', 'pointer', 'keyboard']);
  } finally {
    if (previousResizeObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previousResizeObserver;
  }
});
