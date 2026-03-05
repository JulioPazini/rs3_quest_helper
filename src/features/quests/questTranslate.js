const requestWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const decodeGoogleTranslatePayload = (payload) => {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
  return payload[0]
    .map((chunk) => (Array.isArray(chunk) ? String(chunk[0] || '') : ''))
    .join('')
    .trim();
};

const translateText = async (text, targetLang = 'pt-BR') => {
  const value = String(text || '').trim();
  if (!value) return '';

  const endpoints = [
    async () => {
      const url =
        'https://translate.googleapis.com/translate_a/single' +
        `?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(value)}`;
      const res = await requestWithTimeout(url, {}, 12000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const translated = decodeGoogleTranslatePayload(payload);
      if (!translated) throw new Error('Empty translation payload');
      return translated;
    },
    async () => {
      const url =
        'https://api.mymemory.translated.net/get' +
        `?q=${encodeURIComponent(value)}&langpair=${encodeURIComponent(`en|${targetLang}`)}`;
      const res = await requestWithTimeout(url, {}, 12000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const translated = String(payload?.responseData?.translatedText || '').trim();
      if (!translated) throw new Error('Empty translation payload');
      return translated;
    },
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      return await endpoint();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Translation failed');
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const LINK_TOKEN_PREFIX = '__AQH_LINK_';
const buildLinkToken = (index) => `${LINK_TOKEN_PREFIX}${index}__`;

const canUseFullSentenceLinkTranslation = (sourceHtml) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = String(sourceHtml || '');
  const anchors = wrap.querySelectorAll('a[href], a');
  if (anchors.length === 0) return false;
  // Full-sentence mode rehydrates only links.
  // Use it only when markup is anchors + text, so we don't lose formatting tags.
  return !wrap.querySelector('*:not(a)');
};

const translateWholeTextPreservingLinks = async (sourceHtml, targetLang) => {
  const wrap = document.createElement('div');
  wrap.innerHTML = sourceHtml;
  const anchors = Array.from(wrap.querySelectorAll('a[href], a'));
  if (anchors.length === 0) return null;

  const linkHtmlByToken = new Map();
  anchors.forEach((anchor, index) => {
    const token = buildLinkToken(index);
    linkHtmlByToken.set(token, anchor.outerHTML);
    anchor.replaceWith(document.createTextNode(token));
  });

  const fullText = wrap.textContent.replace(/\s+/g, ' ').trim();
  if (!fullText) return sourceHtml;

  const translated = await translateText(fullText, targetLang);
  if (!translated) throw new Error('Empty full translation');

  let out = escapeHtml(translated);
  let restoredAnyToken = false;
  linkHtmlByToken.forEach((linkHtml, token) => {
    if (out.includes(token)) restoredAnyToken = true;
    out = out.split(token).join(linkHtml);
  });
  if (!restoredAnyToken) {
    throw new Error('Link placeholders were not preserved by translator');
  }
  return out;
};

const shouldTranslateTextNode = (node) => {
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  const raw = String(node.nodeValue || '');
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  const tag = String(parent.tagName || '').toLowerCase();
  if (['script', 'style', 'code', 'pre', 'kbd', 'samp'].includes(tag)) return false;
  if (parent.closest('script, style, code, pre, kbd, samp')) return false;
  return true;
};

export const translateStepHtmlToPtBr = async ({ html, text = '', targetLang = 'pt-BR' } = {}) => {
  const sourceHtml = String(html || '').trim();
  if (!sourceHtml) {
    const translated = await translateText(text, targetLang);
    return translated || text;
  }

  // Prefer full-sentence translation when links are present, to preserve context.
  try {
    if (canUseFullSentenceLinkTranslation(sourceHtml)) {
      const fullWithLinks = await translateWholeTextPreservingLinks(sourceHtml, targetLang);
      if (fullWithLinks) return fullWithLinks;
    }
  } catch (_err) {
    // Fallback below preserves current behavior.
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = sourceHtml;

  const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let textNode;
  while ((textNode = walker.nextNode())) {
    if (shouldTranslateTextNode(textNode)) nodes.push(textNode);
  }

  const uniqueMap = new Map();
  for (const node of nodes) {
    const fullText = String(node.nodeValue || '');
    const core = fullText.trim();
    if (!core || uniqueMap.has(core)) continue;
    uniqueMap.set(core, await translateText(core, targetLang));
  }

  nodes.forEach((node) => {
    const fullText = String(node.nodeValue || '');
    const core = fullText.trim();
    if (!core) return;
    const translated = uniqueMap.get(core);
    if (!translated) return;
    const leading = (fullText.match(/^\s*/) || [''])[0];
    const trailing = (fullText.match(/\s*$/) || [''])[0];
    node.nodeValue = `${leading}${translated}${trailing}`;
  });

  return wrap.innerHTML;
};
