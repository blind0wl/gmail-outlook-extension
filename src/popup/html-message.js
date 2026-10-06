const TAGS = new Set('a abbr b blockquote br caption center code col colgroup dd del div dl dt em font h1 h2 h3 h4 h5 h6 hr i img li ol p pre s small span strong sub sup table tbody td tfoot th thead tr u ul'.split(' '));
const DROP = new Set('script style iframe object embed svg math form input button textarea select option link meta base head template noscript'.split(' '));
const ATTRS = new Set('alt title colspan rowspan align valign dir lang width height cellpadding cellspacing border'.split(' '));
const STYLES = new Set('color background-color font-family font-size font-weight font-style text-decoration text-align vertical-align line-height letter-spacing word-spacing white-space overflow-wrap word-break width min-width max-width height min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-color border-width border-style border-radius border-collapse border-spacing display list-style-type'.split(' '));

export function safeMessageUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function safeStyle(value) {
  return value.split(';').flatMap(declaration => {
    const colon = declaration.indexOf(':');
    if (colon < 0) return [];
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    // Keep typography/table styling, never URLs, escapes, positioning or code.
    if (!STYLES.has(name) || !/^[#\w\s.,()%+\-"']+$/.test(value)
      || /url|expression|image|var\s*\(|behavior/i.test(value)) return [];
    return [name + ':' + value];
  }).join(';');
}

export function sanitizedMessage(content, document, loadImages = false) {
  const template = document.createElement('template');
  template.innerHTML = content;
  // Build in the template's inert document so even opt-in image URLs cannot
  // start a request in the extension document during sanitization.
  const inert = template.content.ownerDocument;
  const output = inert.createElement('div');
  let remoteImages = 0;
  function copy(node, parent) {
    if (node.nodeType === 3) { parent.appendChild(inert.createTextNode(node.textContent)); return; }
    if (node.nodeType !== 1) return;
    const tag = node.localName.toLowerCase();
    if (DROP.has(tag)) return;
    if (!TAGS.has(tag)) { Array.from(node.childNodes).forEach(child => copy(child, parent)); return; }
    const clean = inert.createElement(tag);
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (ATTRS.has(name)) clean.setAttribute(name, attr.value);
    }
    const style = safeStyle(node.getAttribute('style') || '');
    if (style) clean.setAttribute('style', style);
    if (tag === 'font') {
      for (const name of ['color', 'face', 'size']) if (node.hasAttribute(name)) clean.setAttribute(name, node.getAttribute(name));
    }
    if (tag === 'a') {
      const href = safeMessageUrl(node.getAttribute('href'));
      if (href) { clean.setAttribute('href', href); clean.setAttribute('rel', 'noopener noreferrer'); }
    }
    if (tag === 'img') {
      const src = safeMessageUrl(node.getAttribute('src'));
      if (src?.startsWith('https:')) {
        remoteImages++;
        if (loadImages) { clean.setAttribute('referrerpolicy', 'no-referrer'); clean.setAttribute('src', src); }
        else {
          const placeholder = inert.createElement('span');
          placeholder.className = 'image-placeholder';
          placeholder.textContent = clean.getAttribute('alt') || 'Image';
          parent.appendChild(placeholder);
          return;
        }
      } else {
        // cid: attachments and insecure/unsupported image URLs stay in mailbox.
        const placeholder = inert.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = clean.getAttribute('alt') || 'Image available in mailbox';
        parent.appendChild(placeholder);
        return;
      }
    }
    Array.from(node.childNodes).forEach(child => copy(child, clean));
    parent.appendChild(clean);
  }
  Array.from(template.content.childNodes).forEach(node => copy(node, output));
  const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src " + (loadImages ? 'https:' : "'none'") + "; form-action 'none'; base-uri 'none'";
  return {
    remoteImages,
    html: '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>'
      + 'html{color-scheme:light;background:#fff}body{margin:0;padding:16px;box-sizing:border-box;font:14px/1.5 Arial,sans-serif;color:#222;overflow-wrap:anywhere}*{box-sizing:border-box;max-width:100%}table{width:100%!important;min-width:0!important;table-layout:fixed}td,th{overflow-wrap:anywhere}img{max-width:100%!important;height:auto!important}pre{white-space:pre-wrap}a{color:#1558bc}.image-placeholder{display:inline-block;padding:6px 10px;border:1px dashed #bbb;border-radius:4px;color:#666;font-size:12px}'
      + '</style></head><body>' + output.innerHTML + '</body></html>',
  };
}

export function createHtmlMessage(content, document, { loadImages = false, onLoadImages, onEscape, onLink, onReading } = {}) {
  const sanitized = sanitizedMessage(content, document, loadImages);
  const container = document.createElement('div');
  container.className = 'html-message';
  if (sanitized.remoteImages && !loadImages) {
    const tools = document.createElement('div');
    tools.className = 'message-image-tools';
    const label = document.createElement('span');
    label.textContent = 'External images are hidden.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Load images';
    button.addEventListener('click', event => { event.stopPropagation(); onLoadImages?.(); });
    tools.append(label, button);
    container.appendChild(tools);
  }
  const frame = document.createElement('iframe');
  frame.className = 'message-frame';
  frame.title = 'Formatted email';
  // Same-origin permits trusted parent sizing/link handlers. Scripts remain
  // forbidden by both sandbox and the frame's CSP; no allow-scripts ever.
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.srcdoc = sanitized.html;
  frame.addEventListener('load', () => {
    const inner = frame.contentDocument;
    if (!inner?.body) return;
    const resize = () => { frame.style.height = Math.ceil(Math.max(inner.body.getBoundingClientRect().height, inner.body.scrollHeight)) + 1 + 'px'; };
    resize();
    inner.addEventListener("load", resize, true);
    inner.addEventListener("pointermove", () => onReading?.("pointer"));
    inner.addEventListener("pointerdown", () => onReading?.("pointer"));
    inner.addEventListener("wheel", () => onReading?.("pointer"), { passive: true });
    inner.addEventListener("scroll", () => onReading?.("pointer"), true);
    inner.addEventListener("keydown", () => onReading?.("keyboard"));
    const observer = new ResizeObserver(resize);
    observer.observe(inner.body);
    inner.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor) return;
      event.preventDefault();
      const href = safeMessageUrl(anchor.getAttribute('href'));
      if (href) onLink?.(href);
    });
    inner.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); onEscape?.(); }
    });
    // Disconnect on frame navigation/destruction as well as page shutdown.
    frame.contentWindow.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  });
  container.appendChild(frame);
  return container;
}
