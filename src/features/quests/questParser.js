export const formatStepText = (text) => {
  if (!text) return text;
  const pattern = /\(\s*(?:\d+[^)]*|[^)]*[\u2022\u2713][^)]*)\)\s*[.!?]?\s*$/;
  return pattern.test(text) ? `${text} \uD83D\uDCAC` : text;
};

export const formatStepHtml = (html, text) => {
  if (!html) return html;
  const pattern = /\(\s*(?:\d+[^)]*|[^)]*[\u2022\u2713][^)]*)\)\s*[.!?]?\s*$/;
  return pattern.test(text || '') ? `${html} \uD83D\uDCAC` : html;
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
  if (!img) return null;
  let src = img.getAttribute('src');
  if (!src) return null;
  if (src.startsWith('//')) src = 'https:' + src;
  if (src.startsWith('/')) src = 'https://runescape.wiki' + src;
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

  const root = doc.querySelector('.mw-parser-output');
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
    let htmlOut = clone.innerHTML.trim();
    htmlOut = htmlOut.replace(/\b(Needed|Recommended)\b/g, '<strong>$1</strong>');
    return htmlOut;
  };

  const getSectionImageData = (el) => {
    if (!el || !el.querySelectorAll) return [];
    const out = [];
    const figures = el.matches('figure') ? [el] : Array.from(el.querySelectorAll('figure'));
    figures.forEach((figure) => {
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
    return clone.innerHTML.replace(/\s+/g, ' ').trim();
  };

  let node;
  while ((node = walker.nextNode())) {
    if (finished) break;

    if (node.id === 'toc') continue;

    if (/^H[2-4]$/.test(node.tagName)) {
      const text = node.textContent.trim();
      if (text && !['Contents', 'Overview', 'Rewards', 'Required for completing'].includes(text)) {
        lastHeader = text;
        let seeAlso = [];
        let sectionImages = [];
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
          sibling = sibling.nextElementSibling;
        }

        result.push({
          type: 'title',
          text,
          seeAlso,
          sectionImages,
        });
        lastTitleIndex = result.length - 1;
      }
      continue;
    }

    if (node.classList && node.classList.contains('seealso')) {
      if (lastTitleIndex !== null) {
        const htmlOut = getSeeAlsoHtml(node);
        if (htmlOut) result[lastTitleIndex].seeAlso.push(htmlOut);
      }
      continue;
    }

    if (
      (node.tagName === 'UL' || node.tagName === 'OL') &&
      lastHeader &&
      !node.closest('table') &&
      !node.closest('li') &&
      !node.closest('.advanced-map.amap-right')
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
