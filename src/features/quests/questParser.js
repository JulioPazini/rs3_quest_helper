const DIALOGUE_ICON = '\uD83D\uDCAC';
const hasDialogueMarker = (value) => {
  if (!value) return false;
  // Match dialogue/chat markers like "(Chat 1)", "(1•2•3)", "(2•✓)", "(4)", "(~)" anywhere in the step.
  return /\(\s*(?:chat\b[^)]*|~+|(?=[^)]*[\d\u2022\u2713])[\d\s\u2022\u2713.,]+)\s*\)/i.test(
    String(value)
  );
};

export const formatStepText = (text) => {
  if (!text) return text;
  if (String(text).includes(DIALOGUE_ICON)) return text;
  return hasDialogueMarker(text) ? `${text} ${DIALOGUE_ICON}` : text;
};

export const formatStepHtml = (html, text) => {
  if (!html) return html;
  if (String(html).includes(DIALOGUE_ICON)) return html;
  return hasDialogueMarker(text || html) ? `${html} ${DIALOGUE_ICON}` : html;
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
    const rewardFigure = Array.from(
      doc.querySelectorAll('figure a[href], figure img[src]')
    ).find((el) => {
      const href = (el.getAttribute('href') || '').toLowerCase();
      const src = (el.getAttribute('src') || '').toLowerCase();
      return href.includes('_reward') || src.includes('_reward');
    });
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
  let lastTitleIndex = null;
  let finished = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);

  const stripTooltipContent = (rootEl) => {
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

    const ariaHidden = rootEl.querySelectorAll("[aria-hidden='true']");
    ariaHidden.forEach((el) => el.remove());

    const styled = rootEl.querySelectorAll('[style]');
    styled.forEach((el) => {
      const style = el.getAttribute('style') || '';
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) {
        el.remove();
      }
    });

    const advancedMaps = rootEl.querySelectorAll('.advanced-map, .mw-kartographer-container');
    advancedMaps.forEach((el) => el.remove());
    const mapLinks = rootEl.querySelectorAll('.mw-kartographer-maplink, .mw-kartographer-link');
    mapLinks.forEach((el) => el.remove());
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
    const figures = el.matches('figure') ? [el] : Array.from(el.querySelectorAll('figure'));
    figures.forEach((figure) => {
      if (figure.closest('.advanced-map, .mw-kartographer-container')) return;
      if (figure.closest('table, .messagebox, .lighttable')) return;
      const img = figure.querySelector('img');
      if (!img) return;
      let src = img.getAttribute('src') || '';
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;
      if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
      const alt = (img.getAttribute('alt') || '').trim();
      const captionEl = figure.querySelector('figcaption');
      const caption = captionEl ? captionEl.textContent.replace(/\s+/g, ' ').trim() : '';
      out.push({ src, alt, caption });
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
      out.push(clone.outerHTML);
    });
    return out;
  };

  const isRelevantStandaloneTable = (table) => {
    if (!table) return false;
    if (table.classList.contains('messagebox')) return false;
    if (table.classList.contains('questdetails')) return false;
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
      const htmlOut = getNormalizedOuterHtml(table);
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
    return clone.textContent.replace(/\s+/g, ' ').trim();
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
    return clone.innerHTML.replace(/\s+/g, ' ').trim();
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

  const getNormalizedOuterHtml = (el) => {
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
    return clone.outerHTML;
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
        });
        lastTitleIndex = result.length - 1;
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
          html: getNormalizedOuterHtml(node),
        });
      }
      continue;
    }

    if (lastHeader && node.tagName === 'TABLE' && isRelevantStandaloneTable(node)) {
      const htmlOut = getNormalizedOuterHtml(node);
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

        const substeps = Array.from(li.querySelectorAll(':scope > ul > li, :scope > ol > li'))
          .map((subLi) => ({
            text: getListItemText(subLi),
            html: getListItemHtml(subLi),
          }))
          .filter((t) => t.text.length > 0);

        result.push({
          type: 'step',
          text,
          html: htmlOut,
          checked: false,
          substeps,
        });

        if (/quest complete/i.test(text)) {
          finished = true;
          break;
        }
      }
    }
  }

  return result;
}

