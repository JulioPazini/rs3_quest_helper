const normalizeSrc = (src) => {
  if (!src) return '';
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('/')) return 'https://runescape.wiki' + src;
  return src;
};

const cleanText = (value) =>
  String(value || '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHeaderCell = (th) => {
  const text = cleanText(th.textContent).toLowerCase();
  if (text) return text;
  const img = th.querySelector('img');
  if (img) {
    const alt = cleanText(img.getAttribute('alt')).toLowerCase();
    const title = cleanText(img.getAttribute('title')).toLowerCase();
    if (
      alt.includes('member') ||
      alt.includes('p2p') ||
      title.includes('member') ||
      title.includes('subscription')
    ) {
      return 'members';
    }
  }
  return '';
};

const parseMembership = (cell) => {
  if (!cell) return '';
  const img = cell.querySelector('img');
  const alt = cleanText((img && img.getAttribute('alt')) || '').toLowerCase();
  if (alt.includes('free-to-play') || alt.includes('free to play') || alt === 'free') {
    return 'free';
  }
  if (alt.includes('member') || alt.includes('members')) {
    return 'members';
  }

  const sample = cleanText(
    `${img ? img.getAttribute('title') || '' : ''} ${cell.textContent || ''}`
  ).toLowerCase();
  if (sample.includes('member') || sample.includes('p2p') || sample.includes('subscription')) {
    return 'members';
  }
  if (sample.includes('free') || sample.includes('f2p') || sample.includes('non-member')) {
    return 'free';
  }
  return '';
};

let questList = [];
let questListLoadingPromise = null;

const fetchJsonWithTimeoutRetry = async (
  url,
  { timeoutMs = 7000, retries = 1, retryDelayMs = 300 } = {}
) => {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Request failed');
};

export const getQuestList = () => questList;

export const setQuestList = (list) => {
  questList = Array.isArray(list) ? list : questList;
};

export const loadQuestList = async () => {
  if (questListLoadingPromise) return questListLoadingPromise;
  const cacheKey = 'questListCacheV2';
  questListLoadingPromise = (async () => {
    if (questList.length > 0) {
      const valid = questList.every(
        (item) => item && typeof item.title === 'string' && item.title.trim()
      );
      if (valid) return;
      questList = [];
    }
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
      const cached = JSON.parse(cacheRaw);
      if (cached && Array.isArray(cached.list) && cached.ts) {
        const ageMs = Date.now() - cached.ts;
        if (ageMs < 24 * 60 * 60 * 1000) {
          const valid = cached.list.every(
            (item) => item && typeof item.title === 'string' && item.title.trim()
          );
          if (valid) {
            questList = cached.list;
            return;
          }
        }
      }
    }

    const url =
      'https://runescape.wiki/api.php' +
      '?action=parse' +
      '&format=json' +
      '&origin=*' +
      '&page=List_of_quests' +
      '&prop=text';
    const data = await fetchJsonWithTimeoutRetry(url, {
      timeoutMs: 7000,
      retries: 1,
      retryDelayMs: 300,
    });
    const html = data && data.parse && data.parse.text ? data.parse.text['*'] : '';
    if (!html) {
      throw new Error('Empty List_of_quests html');
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table.wikitable');
    if (!tables || tables.length === 0) {
      questList = [];
      return;
    }

    let table = null;
    let headerRow = null;
    let headers = [];

    const findHeaderRow = (t) => {
      const rows = t.querySelectorAll('tr');
      for (const row of rows) {
        const ths = row.querySelectorAll('th');
        if (!ths || ths.length === 0) continue;
        const cols = Array.from(ths).map((th) => normalizeHeaderCell(th));
        return { row, cols };
      }
      return null;
    };

    tables.forEach((t) => {
      if (table) return;
      const header = findHeaderRow(t);
      if (!header) return;
      const cols = header.cols;
      const hasQuest = cols.some(
        (c) =>
          /^quest\b/.test(c) || c.includes('quest name') || c === 'name' || c.includes('quests')
      );
      const hasMembers = cols.some((c) => c.includes('members') || c.includes('member'));
      const hasQp = cols.some(
        (c) => c.includes('quest points') || c.includes('qp') || c.includes('q.p')
      );
      if (hasQuest && hasMembers && hasQp) {
        table = t;
        headerRow = header.row;
        headers = cols;
      }
    });

    if (!table) {
      // If we could not identify by headers, use the largest wikitable.
      table =
        Array.from(tables).sort((a, b) => {
          const aRows = a.querySelectorAll('tr').length;
          const bRows = b.querySelectorAll('tr').length;
          return bRows - aRows;
        })[0] || null;
      const fallbackHeader = table ? findHeaderRow(table) : null;
      if (fallbackHeader) {
        headerRow = fallbackHeader.row;
        headers = fallbackHeader.cols;
      }
    }

    if (!table) {
      throw new Error('No wikitable found');
    }

    const hasHeaders = headers.length > 0;
    const getColIndex = (matchers, fallback) => {
      if (!hasHeaders) return fallback;
      const idx = headers.findIndex((h) =>
        matchers.some((m) => (typeof m === 'function' ? m(h) : h.includes(m)))
      );
      return idx >= 0 ? idx : -1;
    };

    const questIdx = getColIndex(
      [(h) => /^quest\b/.test(h), (h) => h.includes('quest name'), (h) => h === 'name'],
      0
    );
    const membersIdx = getColIndex(['members', 'member'], 1);
    const lengthIdx = getColIndex(['length'], 2);
    const ageIdx = getColIndex(['age'], 3);
    const combatIdx = getColIndex(['combat'], 4);
    const qpIdx = getColIndex(['quest points', 'qp', 'q.p'], 5);
    const seriesIdx = getColIndex(['series'], 6);
    const releaseDateIdx = getColIndex(['release date', 'release'], 7);

    const rows = table.querySelectorAll('tr');
    const list = [];
    const seen = new Set();
    rows.forEach((row) => {
      if (row === headerRow) return;
      const cells = row.querySelectorAll('td');
      if (!cells || cells.length === 0) return;
      const titleCell = questIdx >= 0 ? cells[questIdx] : cells[0];
      if (!titleCell) return;
      const titleLink =
        titleCell.querySelector('a[href*="/w/"]:not([href*="redlink=1"]):not([href*="File:"])') ||
        null;
      const title = cleanText(titleLink ? titleLink.textContent : titleCell.textContent);
      if (!title || seen.has(title)) return;
      seen.add(title);

      const membersCell = membersIdx >= 0 ? cells[membersIdx] : cells[1];
      const membersImg = membersCell ? membersCell.querySelector('img') : null;
      const membersIcon = membersImg ? normalizeSrc(membersImg.getAttribute('src')) : '';
      const membership = parseMembership(membersCell);

      const lengthCell =
        lengthIdx >= 0 ? cells[lengthIdx] : !hasHeaders && cells[2] ? cells[2] : null;
      const length = lengthCell ? cleanText(lengthCell.textContent) : '';

      const ageCell = ageIdx >= 0 ? cells[ageIdx] : !hasHeaders && cells[3] ? cells[3] : null;
      const age = ageCell ? cleanText(ageCell.textContent) : '';

      const combatCell =
        combatIdx >= 0 ? cells[combatIdx] : !hasHeaders && cells[4] ? cells[4] : null;
      const combat = combatCell ? cleanText(combatCell.textContent) : '';

      const qpCell = qpIdx >= 0 ? cells[qpIdx] : !hasHeaders && cells[5] ? cells[5] : null;
      const questPoints = qpCell ? cleanText(qpCell.textContent) : '';

      const seriesCell =
        seriesIdx >= 0 ? cells[seriesIdx] : !hasHeaders && cells[6] ? cells[6] : null;
      const series = seriesCell ? cleanText(seriesCell.textContent) : '';

      const releaseDateCell =
        releaseDateIdx >= 0 ? cells[releaseDateIdx] : !hasHeaders && cells[7] ? cells[7] : null;
      const releaseDate = releaseDateCell ? cleanText(releaseDateCell.textContent) : '';

      list.push({
        title,
        membersIcon,
        membership,
        length,
        age,
        combat,
        questPoints,
        series,
        releaseDate,
      });
    });

    questList = list;
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), list }));
  })()
    .catch(async () => {
      // Fallback: use Category:Quests list of titles if the table fetch fails
      try {
        const catUrl =
          'https://runescape.wiki/api.php' +
          '?action=query' +
          '&format=json' +
          '&origin=*' +
          '&list=categorymembers' +
          '&cmtitle=Category:Quests' +
          '&cmlimit=500';
        const data = await fetchJsonWithTimeoutRetry(catUrl, {
          timeoutMs: 6000,
          retries: 1,
          retryDelayMs: 250,
        });
        const members = data?.query?.categorymembers || [];
        const list = members
          .map((m) => (m && m.title ? String(m.title) : ''))
          .filter(Boolean)
          .map((title) => ({
            title,
            membersIcon: '',
            membership: '',
            length: '',
            age: '',
            combat: '',
            questPoints: '',
            series: '',
            releaseDate: '',
          }));
        questList = list;
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), list }));
      } catch (_fallbackErr) {
        questList = [];
      }
    })
    .finally(() => {
      questListLoadingPromise = null;
    });
  return questListLoadingPromise;
};
