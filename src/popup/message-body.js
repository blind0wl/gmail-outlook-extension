// Parse into an inert template, then return text only. Provider markup never
// enters the live document or loads images, scripts, frames or styles.
export function messageBodyText(content, contentType, document) {
  if (contentType === 'text') return content;
  const template = document.createElement('template');
  template.innerHTML = content;
  const blocks = new Set(['P', 'DIV', 'BLOCKQUOTE', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'TABLE']);
  function text(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 && node.nodeType !== 11) return '';
    const tag = node.nodeName;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'HEAD', 'NOSCRIPT'].includes(tag)) return '';
    if (tag === 'BR' || tag === 'HR') return '\n';
    if (tag === 'IMG') return node.getAttribute('alt') || '';
    const value = Array.from(node.childNodes, text).join('');
    return blocks.has(tag) ? '\n' + value + '\n' : tag === 'TD' || tag === 'TH' ? value + '\t' : value;
  }
  return text(template.content).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
