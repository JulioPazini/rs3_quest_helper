const DIALOGUE_ICON = '\u{1F5E8}\uFE0F';
const CHECKMARK_RE = /^[\u2713\u2714]+$/;

const normalizeDialogueMarkerContent = (content) => {
  const raw = String(content || '').trim();
  if (!raw) return '';
  if (/^chat\b/i.test(raw)) return raw.replace(/\s+/g, ' ');
  return raw.replace(/\s*([\u2022\u00B7\u2219])\s*/g, '\u2022').replace(/\s+/g, ' ');
};

const isDialogueMarkerContent = (content) => {
  const normalized = normalizeDialogueMarkerContent(content);
  if (!normalized) return false;
  if (/^chat\b/i.test(normalized)) return true;
  const tokens = normalized
    .split(/\u2022/g)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(
    (token) => /^\d+$/.test(token) || /^~+$/.test(token) || CHECKMARK_RE.test(token)
  );
};

const injectDialogueIconInParentheses = (value) => {
  if (!value) return value;
  return String(value).replace(/\(([^()]*)\)/g, (full, inner) => {
    if (String(inner).includes(DIALOGUE_ICON)) return full;
    if (!isDialogueMarkerContent(inner)) return full;
    const normalized = normalizeDialogueMarkerContent(inner);
    return `(${DIALOGUE_ICON}${normalized ? ` ${normalized}` : ''})`;
  });
};

const hasDialogueMarker = (value) => {
  if (!value) return false;
  return injectDialogueIconInParentheses(value) !== String(value);
};

const stripTrailingDialogueIcon = (value) =>
  String(value || '').replace(/\s*(?:\uD83D\uDCAC|\u{1F5E8}\uFE0F?)\s*$/u, '');

export const formatStepText = (text) => {
  if (!text) return text;
  const cleaned = stripTrailingDialogueIcon(text);
  return injectDialogueIconInParentheses(cleaned);
};

export const formatStepHtml = (html, text) => {
  if (!html) return html;
  const rawHtml = stripTrailingDialogueIcon(html);
  const markerSource = stripTrailingDialogueIcon(text || rawHtml);
  if (!hasDialogueMarker(markerSource)) return rawHtml;
  const wrap = document.createElement('div');
  wrap.innerHTML = rawHtml;
  const chatOptionBlocks = wrap.querySelectorAll('.chat-options');
  chatOptionBlocks.forEach((block) => {
    const blockText = block.textContent.replace(/\s+/g, ' ').trim();
    const formatted = formatStepText(blockText);
    if (formatted !== blockText) {
      block.textContent = formatted;
    }
  });
  const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null);
  let textNode;
  while ((textNode = walker.nextNode())) {
    if (textNode.parentElement && textNode.parentElement.closest('.chat-options')) continue;
    textNode.nodeValue = injectDialogueIconInParentheses(textNode.nodeValue);
  }
  return wrap.innerHTML;
};

const isQuestCompleteTerminalStep = (text) => {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (/^quest complete\b/.test(normalized)) return true;
  if (/^congratulations\b.*\bquest complete\b/.test(normalized)) return true;
  if (/^you have completed\b/.test(normalized)) return true;
  return false;
};
export const getQuestIcon = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const img = doc.querySelector(".questdetails.plainlinks td[data-attr-param='iconDisp'] img");
  if (!img) return null;
  let src = img.getAttribute('src');
  if (!src) return null;
  if (src.startsWith('//')) src = 'https:' + src;
  if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
  return src;
};

export const getRewardImage = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rewardsHeader = doc.querySelector('#Rewards');
  let img = null;
  const normalizeSrc = (src) => {
    if (!src) return null;
    let out = src;
    if (out.startsWith('//')) out = 'https:' + out;
    if (out.startsWith('/')) out = 'https://runescape.wiki' + out;
    return out;
  };

  if (rewardsHeader) {
    let node = rewardsHeader.closest('.mw-heading')?.nextElementSibling;
    while (node) {
      if (node.matches('figure.mw-default-size.mw-halign-center')) {
        img = node.querySelector('img');
        break;
      }
      if (node.matches('.mw-heading')) break;
      node = node.nextElementSibling;
    }
  }

  if (!img) {
    const rewardFigure = Array.from(doc.querySelectorAll('figure a[href], figure img[src]')).find(
      (el) => {
        const href = (el.getAttribute('href') || '').toLowerCase();
        const src = (el.getAttribute('src') || '').toLowerCase();
        return href.includes('_reward') || src.includes('_reward');
      }
    );
    if (rewardFigure) {
      img = rewardFigure.tagName === 'IMG' ? rewardFigure : rewardFigure.querySelector('img');
    }
  }

  if (!img) {
    const centeredFigures = doc.querySelectorAll(
      'figure.mw-default-size.mw-halign-center img, figure.mw-halign-center img'
    );
    if (centeredFigures.length > 0) {
      img = centeredFigures[centeredFigures.length - 1];
    }
  }

  if (!img) return null;
  const src = normalizeSrc(img.getAttribute('src'));
  if (!src) return null;
  return src;
};

const normalizeOverviewLinks = (rootEl) => {
  const links = rootEl.querySelectorAll('a[href]');
  links.forEach((a) => {
    let href = a.getAttribute('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
    a.setAttribute('href', href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
};

const normalizeOverviewImages = (rootEl) => {
  const imgs = rootEl.querySelectorAll('img[src]');
  imgs.forEach((img) => {
    let src = img.getAttribute('src') || '';
    if (src.startsWith('//')) src = 'https:' + src;
    if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
    img.setAttribute('src', src);
  });
};

const stripOverviewNoise = (rootEl) => {
  const tooltipSelectors = [
    "[role='tooltip']",
    '.tooltip',
    '.tooltiptext',
    '.mw-tooltip',
    '.mw-ext-tooltip',
  ];
  const tooltips = rootEl.querySelectorAll(tooltipSelectors.join(','));
  tooltips.forEach((t) => t.remove());

  const ariaHidden = rootEl.querySelectorAll("[aria-hidden='true']");
  ariaHidden.forEach((el) => el.remove());

  const styled = rootEl.querySelectorAll('[style]');
  styled.forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) {
      el.remove();
    }
  });
};

export const getQuestOverview = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table.questdetails.plainlinks');
  if (!table) return null;

  const getAttrHtml = (attr) => {
    const cell = table.querySelector(`td[data-attr-param='${attr}']`);
    if (!cell) return '';
    const clone = cell.cloneNode(true);
    stripOverviewNoise(clone);
    normalizeOverviewLinks(clone);
    normalizeOverviewImages(clone);
    return clone.innerHTML.trim();
  };

  const getHeaderHtml = (label) => {
    const header = Array.from(table.querySelectorAll('th')).find((th) =>
      th.textContent.trim().toLowerCase().startsWith(label.toLowerCase())
    );
    if (!header) return '';
    const row = header.closest('tr');
    if (!row) return '';
    const cell = row.querySelector('td');
    if (!cell) return '';
    const clone = cell.cloneNode(true);
    stripOverviewNoise(clone);
    normalizeOverviewLinks(clone);
    normalizeOverviewImages(clone);
    return clone.innerHTML.trim();
  };

  const requirementsHtml = getAttrHtml('requirements') || getHeaderHtml('Requirements');

  const extractRequirementsSplit = (rawHtml) => {
    if (!rawHtml) return { quests: '', skills: '', questsIcon: '' };
    const wrap = document.createElement('div');
    wrap.innerHTML = rawHtml;

    const questBlock = wrap.querySelector('table.questreq');
    let questsHtml = '';
    let questsIcon = '';
    if (questBlock) {
      const questHeader = questBlock.querySelector('th');
      if (questHeader) {
        const headerImg = questHeader.querySelector('img');
        if (headerImg) {
          let src = headerImg.getAttribute('src') || '';
          if (src.startsWith('//')) src = 'https:' + src;
          if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
          questsIcon = src;
        }
      }
      const cleaned = questBlock.cloneNode(true);
      const headerRow = cleaned.querySelector('tr');
      if (headerRow) headerRow.remove();
      questsHtml = cleaned.outerHTML.trim();
    }

    const ironmenBlock = Array.from(wrap.querySelectorAll('table.mw-collapsible')).find((table) => {
      const header = table.querySelector('th');
      return header && header.textContent.toLowerCase().includes('ironmen');
    });

    const buildSkillList = (scope, excludeNode) => {
      const list = document.createElement('ul');
      const lis = Array.from(scope.querySelectorAll('li')).filter((li) => {
        if (!li.querySelector('.skillreq')) return false;
        if (excludeNode && excludeNode.contains(li)) return false;
        return true;
      });
      lis.forEach((li) => {
        const clone = li.cloneNode(true);
        stripOverviewNoise(clone);
        normalizeOverviewLinks(clone);
        normalizeOverviewImages(clone);
        list.appendChild(clone);
      });
      return list.children.length ? list.outerHTML.trim() : '';
    };

    const mainSkillsHtml = buildSkillList(wrap, ironmenBlock);

    let ironmenSkillsHtml = '';
    if (ironmenBlock) {
      const ironmenList = buildSkillList(ironmenBlock, null);
      if (ironmenList) {
        let ironmenHeaderHtml = '';
        const header = ironmenBlock.querySelector('th');
        if (header) {
          const headerClone = header.cloneNode(true);
          stripOverviewNoise(headerClone);
          normalizeOverviewLinks(headerClone);
          normalizeOverviewImages(headerClone);
          ironmenHeaderHtml = headerClone.innerHTML
            .replace(/<button[^>]*>.*?<\/button>/gi, '')
            .trim();
        }
        ironmenSkillsHtml = `
          <div class="ironmen-title">${ironmenHeaderHtml || '<strong>Ironmen:</strong>'}</div>
          ${ironmenList}
        `.trim();
      }
    }

    const skillsHtml = [mainSkillsHtml, ironmenSkillsHtml].filter(Boolean).join('');

    return { quests: questsHtml, skills: skillsHtml, questsIcon };
  };

  const requirementsSplit = extractRequirementsSplit(requirementsHtml);

  return {
    requirements: requirementsHtml,
    requirementsQuests: requirementsSplit.quests,
    requirementsSkills: requirementsSplit.skills,
    requirementsQuestsIcon: requirementsSplit.questsIcon,
    requiredItems: getAttrHtml('itemsDisp'),
    recommendedItems: getAttrHtml('recommendedDisp'),
    combat: getAttrHtml('kills'),
  };
};

export function extractQuickGuide(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const contentRoot = doc.querySelector('#mw-content-text');
  const root =
    contentRoot?.querySelector('.mw-parser-output') ||
    contentRoot ||
    doc.querySelector('.mw-parser-output');
  if (!root) return [];

  const result = [];
  let lastHeader = null;
  let finished = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  const stripTooltipContent = (rootEl, options = {}) => {
    const { preserveAdvancedMaps = false } = options;
    const tooltipSelectors = [
      "[role='tooltip']",
      '.tooltip',
      '.tooltiptext',
      '.mw-tooltip',
      '.mw-ext-tooltip',
    ];
    const tooltips = rootEl.querySelectorAll(tooltipSelectors.join(','));
    tooltips.forEach((t) => t.remove());

    const chatIcons = rootEl.querySelectorAll(
      "img[alt='Chat'], img[alt='Quick chat'], img[alt='Quick Chat'], .chat-options img"
    );
    chatIcons.forEach((el) => el.remove());
    const chatTables = rootEl.querySelectorAll(
      '.chat-options table, .chat-options-dialogue table, .js-tooltip-click table, [data-tooltip-name] table'
    );
    chatTables.forEach((el) => el.remove());

    const ariaHidden = rootEl.querySelectorAll("[aria-hidden='true']");
    ariaHidden.forEach((el) => el.remove());

    const styled = rootEl.querySelectorAll('[style]');
    styled.forEach((el) => {
      const style = el.getAttribute('style') || '';
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) {
        el.remove();
      }
    });

    if (!preserveAdvancedMaps) {
      const advancedMaps = rootEl.querySelectorAll('.advanced-map, .mw-kartographer-container');
      advancedMaps.forEach((el) => el.remove());
    }
    if (!preserveAdvancedMaps) {
      const mapLinks = rootEl.querySelectorAll('.mw-kartographer-maplink, .mw-kartographer-link');
      mapLinks.forEach((el) => el.remove());
    }
  };

  const getSeeAlsoHtml = (el) => {
    const clone = el.cloneNode(true);
    stripTooltipContent(clone);
    const links = clone.querySelectorAll('a[href]');
    links.forEach((a) => {
      let href = a.getAttribute('href') || '';
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    const images = clone.querySelectorAll('img[src]');
    images.forEach((img) => {
      let src = img.getAttribute('src') || '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      img.setAttribute('src', src);
    });
    let htmlOut = clone.innerHTML.trim();
    htmlOut = htmlOut.replace(
      /\b(needed|recommended)\b/gi,
      (match) => `<strong>${match.charAt(0).toUpperCase()}${match.slice(1).toLowerCase()}</strong>`
    );
    return htmlOut;
  };

  const getSectionImageData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const seenSrc = new Set();
    const normalizeSrc = (rawSrc) => {
      let src = rawSrc || '';
      if (!src) return '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      return src;
    };
    const pushImageData = ({ rawSrc, alt = '', caption = '' }) => {
      const src = normalizeSrc(rawSrc);
      if (!src || seenSrc.has(src)) return;
      seenSrc.add(src);
      out.push({
        src,
        alt: String(alt || '').trim(),
        caption: String(caption || '').trim(),
      });
    };

    const figures = el.matches('figure') ? [el] : Array.from(el.querySelectorAll('figure'));
    figures.forEach((figure) => {
      if (figure.closest('.advanced-map, .mw-kartographer-container')) return;
      if (figure.closest('table.questdetails')) return;
      if (figure.closest('table, .messagebox, .lighttable')) return;
      const img = figure.querySelector('img');
      if (!img) return;
      const rawSrc = img.getAttribute('src') || '';
      if (!rawSrc) return;
      const alt = img.getAttribute('alt') || '';
      const captionEl = figure.querySelector('figcaption');
      const caption = captionEl ? captionEl.textContent.replace(/\s+/g, ' ').trim() : '';
      pushImageData({ rawSrc, alt, caption });
    });

    // MediaWiki galleries: <ul class="gallery"> <li class="gallerybox"> ... </li> </ul>
    const galleryBoxes = el.matches('li.gallerybox')
      ? [el]
      : Array.from(el.querySelectorAll('ul.gallery li.gallerybox'));
    galleryBoxes.forEach((box) => {
      if (!box) return;
      if (box.closest('.advanced-map, .mw-kartographer-container')) return;
      if (box.closest('table.questdetails')) return;
      if (box.closest('table, .messagebox, .lighttable')) return;
      const img = box.querySelector('img[src]');
      if (!img) return;
      const rawSrc = img.getAttribute('src') || '';
      if (!rawSrc) return;
      const alt = img.getAttribute('alt') || '';
      const captionEl = box.querySelector('.gallerytext');
      const caption = captionEl ? captionEl.textContent.replace(/\s+/g, ' ').trim() : '';
      pushImageData({ rawSrc, alt, caption });
    });

    // Some quick guides place image galleries in dl/dd > table blocks.
    // Keep table parsing behavior unchanged, but still surface those images.
    const tableImgs = el.matches('table img')
      ? [el]
      : Array.from(el.querySelectorAll('table img, dl img, dd img'));
    tableImgs.forEach((img) => {
      if (!img) return;
      if (img.closest('.advanced-map, .mw-kartographer-container')) return;
      if (img.closest('table.questdetails')) return;
      if (img.closest('figure, .messagebox, .lighttable')) return;
      const closestTable = img.closest('table');
      if (closestTable && isRelevantStandaloneTable(closestTable)) return;
      const rawSrc = img.getAttribute('src') || '';
      if (!rawSrc) return;
      const alt = img.getAttribute('alt') || '';
      pushImageData({ rawSrc, alt });
    });

    // Some guides use inline <p><img ...></p> (or blockquote/dl variants) instead of <figure>.
    // Capture those images so they can be rendered even when section text blocks are hidden.
    const inlineImgs = el.matches('p, blockquote, dl')
      ? Array.from(el.querySelectorAll('img'))
      : Array.from(el.querySelectorAll('p img, blockquote img, dl img'));
    inlineImgs.forEach((img) => {
      if (!img) return;
      if (img.closest('.advanced-map, .mw-kartographer-container')) return;
      if (img.closest('table.questdetails')) return;
      if (img.closest('figure, .messagebox, .lighttable')) return;
      const closestTable = img.closest('table');
      if (closestTable && isRelevantStandaloneTable(closestTable)) return;
      const rawSrc = img.getAttribute('src') || '';
      if (!rawSrc) return;
      const alt = img.getAttribute('alt') || '';
      pushImageData({ rawSrc, alt });
    });
    return out;
  };

  const getSectionTextData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const candidates = [];
    if (el.matches('p, dl, blockquote')) {
      candidates.push(el);
    }
    const inner = Array.from(el.querySelectorAll('p, dl, blockquote'));
    inner.forEach((node) => {
      if (!candidates.includes(node)) candidates.push(node);
    });

    candidates.forEach((node) => {
      if (!node) return;
      if (node.closest('table, figure, .seealso, .advanced-map, .mw-kartographer-container'))
        return;
      const clone = node.cloneNode(true);
      stripTooltipContent(clone);
      const links = clone.querySelectorAll('a[href]');
      links.forEach((a) => {
        let href = a.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
      const images = clone.querySelectorAll('img[src]');
      images.forEach((img) => {
        let src = img.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
        img.setAttribute('src', src);
      });
      const htmlOut = clone.innerHTML.replace(/\s+/g, ' ').trim();
      const textOut = clone.textContent.replace(/\s+/g, ' ').trim();
      if (!htmlOut || !textOut) return;
      out.push(htmlOut);
    });
    return out;
  };

  const getSectionInfoBoxData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const tables = el.matches('table.messagebox')
      ? [el]
      : Array.from(el.querySelectorAll('table.messagebox'));
    tables.forEach((table) => {
      if (!table) return;
      if (table.closest('.advanced-map, .mw-kartographer-container')) return;
      const clone = table.cloneNode(true);
      stripTooltipContent(clone, { preserveAdvancedMaps: true });
      const links = clone.querySelectorAll('a[href]');
      links.forEach((a) => {
        let href = a.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
      const images = clone.querySelectorAll('img[src]');
      images.forEach((img) => {
        let src = img.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
        img.setAttribute('src', src);
      });
      out.push(clone.outerHTML);
    });
    return out;
  };

  const isRelevantStandaloneTable = (table) => {
    if (!table) return false;
    if (table.parentElement?.closest('table')) return false;
    if (table.classList.contains('messagebox')) return false;
    if (table.classList.contains('questdetails')) return false;
    if (
      table.closest('.chat-options, .chat-options-dialogue, .js-tooltip-click, [data-tooltip-name]')
    ) {
      return false;
    }
    if (table.closest('div.lighttable.checklist')) return false;
    if (table.closest('.advanced-map, .mw-kartographer-container')) return false;
    if (table.closest('dl, dd')) return false;
    return true;
  };

  const isTopLevelReflist = (block) => {
    if (!block) return false;
    if (!block.matches('.reflist, ol.references, ul.references')) return false;
    if (block.closest('.advanced-map, .mw-kartographer-container')) return false;
    const parentRef = block.parentElement?.closest('.reflist, ol.references, ul.references');
    return !parentRef;
  };

  const getSectionTableData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const seen = new Set();
    const tables = el.matches('table') ? [el] : Array.from(el.querySelectorAll('table'));
    tables.forEach((table) => {
      if (!isRelevantStandaloneTable(table)) return;
      const htmlOut = getNormalizedOuterHtml(table, { preserveAdvancedMaps: true });
      if (!htmlOut || seen.has(htmlOut)) return;
      seen.add(htmlOut);
      out.push(htmlOut);
    });
    return out;
  };

  const getSectionReflistData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const seen = new Set();
    const blocks = [];
    if (el.matches('.reflist, ol.references, ul.references')) blocks.push(el);
    blocks.push(...Array.from(el.querySelectorAll('.reflist, ol.references, ul.references')));
    blocks.forEach((block) => {
      if (!isTopLevelReflist(block)) return;
      const htmlOut = getNormalizedOuterHtml(block);
      if (!htmlOut || seen.has(htmlOut)) return;
      seen.add(htmlOut);
      out.push(htmlOut);
    });
    return out;
  };

  const getListItemText = (li) => {
    const clone = li.cloneNode(true);
    stripTooltipContent(clone);
    const nestedLists = clone.querySelectorAll('ul, ol');
    nestedLists.forEach((list) => list.remove());
    return formatStepText(clone.textContent.replace(/\s+/g, ' ').trim());
  };

  const getListItemHtml = (li) => {
    const clone = li.cloneNode(true);
    stripTooltipContent(clone);
    const nestedLists = clone.querySelectorAll('ul, ol');
    nestedLists.forEach((list) => list.remove());
    const links = clone.querySelectorAll('a[href]');
    links.forEach((a) => {
      let href = a.getAttribute('href') || '';
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    const images = clone.querySelectorAll('img[src]');
    images.forEach((img) => {
      let src = img.getAttribute('src') || '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      img.setAttribute('src', src);
    });
    const textOut = clone.textContent.replace(/\s+/g, ' ').trim();
    return formatStepHtml(clone.innerHTML.replace(/\s+/g, ' ').trim(), textOut);
  };

  const getSectionAdvancedMapData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const maps = [];
    if (el.matches('.advanced-map, .mw-kartographer-container')) {
      maps.push(el);
    }
    maps.push(
      ...Array.from(el.querySelectorAll('.advanced-map, .mw-kartographer-container')).filter(
        (node) => !node.closest('.advanced-map .mw-kartographer-container')
      )
    );
    const seen = new Set();
    maps.forEach((map) => {
      if (!map) return;
      if (map.classList.contains('mw-kartographer-container') && map.closest('.advanced-map'))
        return;
      if (map.closest('table')) return;
      const clone = map.cloneNode(true);
      const hasKartographer =
        clone.classList.contains('mw-kartographer-container') ||
        clone.querySelector('.mw-kartographer-map, .mw-kartographer-container');
      if (!hasKartographer) return;

      const links = clone.querySelectorAll('a[href]');
      links.forEach((a) => {
        let href = a.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
      const images = clone.querySelectorAll('img[src]');
      images.forEach((img) => {
        let src = img.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
        img.setAttribute('src', src);
        img.setAttribute('loading', 'lazy');
      });

      const htmlOut = clone.outerHTML;
      if (!htmlOut || seen.has(htmlOut)) return;
      seen.add(htmlOut);
      out.push(htmlOut);
    });
    return out;
  };

  const getNestedSubsteps = (li) => {
    if (!li || !li.querySelectorAll) return [];
    const nestedItems = Array.from(li.querySelectorAll(':scope > ul > li, :scope > ol > li'));
    return nestedItems
      .map((nestedLi) => ({
        text: getListItemText(nestedLi),
        html: getListItemHtml(nestedLi),
        checked: false,
        substeps: getNestedSubsteps(nestedLi),
      }))
      .filter((item) => item.text.length > 0);
  };

  const getContentBlockHtml = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    stripTooltipContent(clone);
    const links = clone.querySelectorAll('a[href]');
    links.forEach((a) => {
      let href = a.getAttribute('href') || '';
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    const images = clone.querySelectorAll('img[src]');
    images.forEach((img) => {
      let src = img.getAttribute('src') || '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      img.setAttribute('src', src);
    });
    return clone.innerHTML.replace(/\s+/g, ' ').trim();
  };

  const getNormalizedOuterHtml = (el, options = {}) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    stripTooltipContent(clone, options);
    const links = clone.querySelectorAll('a[href]');
    links.forEach((a) => {
      let href = a.getAttribute('href') || '';
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.startsWith('/')) href = 'https://runescape.wiki' + href;
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    const images = clone.querySelectorAll('img[src]');
    images.forEach((img) => {
      let src = img.getAttribute('src') || '';
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      img.setAttribute('src', src);
    });
    return clone.outerHTML;
  };

  const getImageNotePayload = (el) => {
    if (!el || !el.tagName) return null;
    if (el.closest('li')) return null;
    if (el.closest('table')) return null;
    if (el.closest('.advanced-map, .mw-kartographer-container')) return null;

    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'FIGURE') {
      const images = getSectionImageData(el);
      return images.length > 0 ? images : null;
    }
    if (tag === 'UL' && el.classList?.contains('gallery')) {
      const images = getSectionImageData(el);
      return images.length > 0 ? images : null;
    }
    if (tag === 'P' || tag === 'DL' || tag === 'BLOCKQUOTE') {
      if (!el.querySelector('img')) return null;
      const hasVisibleText = el.textContent.replace(/\s+/g, ' ').trim().length > 0;
      if (hasVisibleText) return null;
      const images = getSectionImageData(el);
      return images.length > 0 ? images : null;
    }
    return null;
  };

  let node;
  while ((node = walker.nextNode())) {
    if (finished) break;

    if (node.id === 'toc') continue;

    if (/^H[2-4]$/.test(node.tagName)) {
      const text = node.textContent.trim();
      const level = Number(node.tagName.replace('H', '')) || 2;
      if (/^rewards$/i.test(text)) {
        finished = true;
        continue;
      }
      if (
        text &&
        ![
          'Contents',
          'Overview',
          'Rewards',
          'Required for completing',
          'Official description',
        ].includes(text)
      ) {
        lastHeader = text;
        let seeAlso = [];
        let sectionImages = [];
        let sectionTexts = [];
        let sectionInfoBoxes = [];
        let sectionTables = [];
        let sectionRefLists = [];
        let sectionAdvancedMaps = [];
        const headingContainer = node.closest('.mw-heading') || node;
        let sibling = headingContainer.nextElementSibling;
        const isNextSectionHeader = (el) => {
          if (!el) return false;
          if (el.classList && Array.from(el.classList).some((c) => /^mw-heading[2-4]$/.test(c))) {
            return true;
          }
          if (/^H[2-4]$/.test(el.tagName)) return true;
          const innerHeader = el.querySelector && el.querySelector('h2, h3, h4');
          return Boolean(innerHeader && innerHeader.closest('.mw-heading') === el);
        };
        while (sibling && !isNextSectionHeader(sibling)) {
          const seeAlsoEl = sibling.classList.contains('seealso')
            ? sibling
            : sibling.querySelector('.seealso');
          if (seeAlsoEl) {
            const htmlOut = getSeeAlsoHtml(seeAlsoEl);
            if (htmlOut) seeAlso.push(htmlOut);
          }
          const images = getSectionImageData(sibling);
          if (images.length) sectionImages = sectionImages.concat(images);
          const texts = getSectionTextData(sibling);
          if (texts.length) sectionTexts = sectionTexts.concat(texts);
          const infoBoxes = getSectionInfoBoxData(sibling);
          if (infoBoxes.length) sectionInfoBoxes = sectionInfoBoxes.concat(infoBoxes);
          const tables = getSectionTableData(sibling);
          if (tables.length) sectionTables = sectionTables.concat(tables);
          const reflists = getSectionReflistData(sibling);
          if (reflists.length) sectionRefLists = sectionRefLists.concat(reflists);
          const advancedMaps = getSectionAdvancedMapData(sibling);
          if (advancedMaps.length) sectionAdvancedMaps = sectionAdvancedMaps.concat(advancedMaps);
          sibling = sibling.nextElementSibling;
        }

        result.push({
          type: 'title',
          text,
          level,
          seeAlso,
          sectionTexts,
          sectionInfoBoxes,
          sectionTables,
          sectionRefLists,
          sectionImages,
          sectionAdvancedMaps,
        });
      }
      continue;
    }

    if (
      lastHeader &&
      node.tagName === 'TABLE' &&
      node.classList &&
      node.classList.contains('messagebox') &&
      !node.closest('.advanced-map') &&
      !node.closest('.mw-kartographer-container')
    ) {
      const htmlOut = getContentBlockHtml(node);
      if (htmlOut) {
        result.push({
          type: 'note',
          noteType: 'infobox',
          html: getNormalizedOuterHtml(node, { preserveAdvancedMaps: true }),
        });
      }
      continue;
    }

    if (lastHeader && node.tagName === 'TABLE' && isRelevantStandaloneTable(node)) {
      const htmlOut = getNormalizedOuterHtml(node, { preserveAdvancedMaps: true });
      if (htmlOut) {
        result.push({
          type: 'note',
          noteType: 'table',
          html: htmlOut,
        });
      }
      continue;
    }

    if (lastHeader && isTopLevelReflist(node)) {
      const htmlOut = getNormalizedOuterHtml(node);
      if (htmlOut) {
        result.push({
          type: 'note',
          noteType: 'reflist',
          html: htmlOut,
        });
      }
      continue;
    }

    if (lastHeader) {
      const imageNoteImages = getImageNotePayload(node);
      if (imageNoteImages && imageNoteImages.length > 0) {
        result.push({
          type: 'note',
          noteType: 'images',
          images: imageNoteImages,
        });
        continue;
      }
    }

    if (
      lastHeader &&
      (node.tagName === 'BLOCKQUOTE' ||
        ((node.tagName === 'P' || node.tagName === 'DL') && !node.closest('blockquote'))) &&
      !node.closest('li') &&
      !node.closest('table') &&
      !node.closest('figure') &&
      !node.closest('.seealso') &&
      !node.closest('.advanced-map') &&
      !node.closest('.mw-kartographer-container')
    ) {
      const htmlOut = getContentBlockHtml(node);
      const textOut = node.textContent.replace(/\s+/g, ' ').trim();
      if (htmlOut && textOut) {
        result.push({
          type: 'note',
          noteType: 'text',
          html: htmlOut,
        });
      }
      continue;
    }

    if (
      (node.tagName === 'UL' || node.tagName === 'OL') &&
      lastHeader &&
      node.closest('div.lighttable.checklist') &&
      !node.closest('table') &&
      !node.closest('li') &&
      !node.closest('.advanced-map') &&
      !node.closest('.mw-kartographer-container')
    ) {
      const items = node.querySelectorAll(':scope > li');

      for (const li of items) {
        const text = getListItemText(li);
        const htmlOut = getListItemHtml(li);
        if (!text) continue;

        const substeps = getNestedSubsteps(li);

        result.push({
          type: 'step',
          text,
          html: htmlOut,
          checked: false,
          substeps,
        });

        if (isQuestCompleteTerminalStep(text)) {
          finished = true;
          break;
        }
      }
    }
  }

  return result;
}
