import {
  extractQuickGuide,
  getQuestIcon,
  getRewardImage,
  getQuestOverview,
} from './questParser.js';
import { renderSteps } from './questRender.js';
import { showSearchControls, hideActionBars } from '../../shared/ui/uiControls.js';

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

const renderStepsSkeleton = (stepsDiv) => {
  if (!stepsDiv) return;
  stepsDiv.innerHTML = `
    <div class="steps-skeleton-wrap">
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line"></div>
      <div class="loading-skeleton skeleton-line"></div>
      <div class="loading-skeleton skeleton-line short"></div>
    </div>
  `;
};

const renderOverviewSkeleton = (overviewDiv) => {
  if (!overviewDiv) return;
  overviewDiv.innerHTML = `
    <div class="overview-skeleton-wrap">
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line"></div>
      <div class="loading-skeleton skeleton-line short"></div>
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line"></div>
      <div class="loading-skeleton skeleton-line short"></div>
    </div>
  `;
};

export async function resolveQuestTitle(input) {
  const url =
    'https://runescape.wiki/api.php' +
    '?action=query' +
    '&format=json' +
    '&origin=*' +
    '&list=search' +
    '&srsearch=' +
    encodeURIComponent(input) +
    '&srlimit=1';

  const data = await fetchJsonWithTimeoutRetry(url, {
    timeoutMs: 6000,
    retries: 1,
    retryDelayMs: 250,
  });

  if (data.query && data.query.search && data.query.search.length > 0) {
    return data.query.search[0].title;
  }

  return null;
}

const fetchGuideParse = async (baseTitle, guideMode = 'quick') => {
  const normalized = String(baseTitle || '').replace(/\s+/g, '_');
  const page = guideMode === 'quick' ? `${normalized}/Quick_guide` : normalized;
  const url =
    'https://runescape.wiki/api.php' +
    '?action=parse' +
    '&format=json' +
    '&origin=*' +
    '&page=' +
    encodeURIComponent(page) +
    '&prop=text|jsconfigvars';

  const data = await fetchJsonWithTimeoutRetry(url, {
    timeoutMs: 7000,
    retries: 1,
    retryDelayMs: 300,
  });

  if (!data?.parse?.text?.['*']) return null;
  return data;
};

const buildGuideCandidates = (questName) => {
  const base = String(questName || '').trim();
  if (!base) return [];
  const out = [base];
  if (!/\(quest\)/i.test(base)) {
    out.push(`${base} (quest)`);
  }
  return out;
};

const isQuestGuideHtml = (html) => {
  if (!html) return false;
  const items = extractQuickGuide(html);
  const overview = getQuestOverview(html);
  const stepCount = items.filter((item) => item.type === 'step').length;
  return Boolean(overview) || stepCount > 0;
};

const resolveQuestGuideData = async (questName) => {
  const candidates = buildGuideCandidates(questName);
  const resolvedTitle = await resolveQuestTitle(questName);
  if (
    resolvedTitle &&
    !candidates.some((item) => item.toLowerCase() === String(resolvedTitle).toLowerCase())
  ) {
    candidates.push(resolvedTitle);
  }

  for (const candidate of candidates) {
    for (const guideMode of ['quick', 'normal']) {
      const parsed = await fetchGuideParse(candidate, guideMode).catch(() => null);
      const html = parsed?.parse?.text?.['*'] || '';
      if (parsed && isQuestGuideHtml(html)) {
        return { baseTitle: candidate, data: parsed, guideMode };
      }
    }
  }

  return null;
};

const buildWikiHref = (title, guideMode) => {
  const page = String(title || '').replace(/\s+/g, '_');
  if (guideMode === 'quick') {
    return `https://runescape.wiki/w/${encodeURIComponent(page)}/Quick_guide`;
  }
  return `https://runescape.wiki/w/${encodeURIComponent(page)}`;
};

const normalizeQuestMetaKey = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(quest\)\s*/gi, ' ')
    .trim()
    .toLowerCase();

const buildQuestMetaLookupKeys = (values) => {
  const keys = new Set();
  (values || []).forEach((value) => {
    const raw = String(value || '').trim();
    if (!raw) return;
    keys.add(raw.toLowerCase());
    keys.add(normalizeQuestMetaKey(raw));
  });
  return Array.from(keys);
};

export async function loadQuest(questName, ctx) {
  const {
    stepsDiv,
    overviewDiv,
    renderOverviewWithState,
    renderTitle,
    updateToggleState,
    setLoading,
    navBar,
    filterToggle,
    viewStepsToggle,
    viewModeToggle,
    setQuestViewMode,
    stickyBar,
    clearSearchResults,
    toggleButton,
    progressIndicator,
    toggleBar,
    playerBar,
    headerEl,
    wikiLink,
    applyCheckedIndices,
    loadProgress,
    buildStepsRenderParams,
    state,
    backButton,
    saveProgress,
    updateProgress,
  } = ctx;

  renderStepsSkeleton(stepsDiv);
  renderTitle(questName, null);
  updateToggleState(state.showAllSteps);
  setLoading(true);
  if (toggleBar) toggleBar.classList.add('hidden');
  if (playerBar) playerBar.classList.add('hidden');
  hideActionBars(navBar, filterToggle);
  clearSearchResults();
  if (overviewDiv) {
    overviewDiv.classList.remove('hidden');
    renderOverviewSkeleton(overviewDiv);
  }
  if (viewStepsToggle) {
    viewStepsToggle.classList.add('hidden');
  }
  if (viewModeToggle) {
    viewModeToggle.classList.add('hidden');
  }

  try {
    const resolved = await resolveQuestGuideData(questName);
    if (!resolved) {
      stepsDiv.innerHTML = 'Quest not found.';
      stepsDiv.classList.remove('hidden');
      if (backButton) backButton.classList.remove('hidden');
      state.currentItems = [];
      state.currentQuestKey = null;
      state.currentKartographerLiveData = null;
      state.showSteps = false;
      setLoading(false);
      hideActionBars(navBar, filterToggle);
      toggleButton.classList.add('hidden');
      if (viewStepsToggle) viewStepsToggle.classList.add('hidden');
      if (viewModeToggle) viewModeToggle.classList.add('hidden');
      if (stickyBar) stickyBar.classList.add('hidden');
      if (progressIndicator) progressIndicator.classList.add('hidden');
      showSearchControls(toggleBar);
      return;
    }

    let finalTitle = resolved.baseTitle || questName;
    if (headerEl) {
      headerEl.classList.add('hidden');
    }

    const data = resolved.data;
    if (!data.parse || !data.parse.text) {
      stepsDiv.innerHTML = 'Guide not available for this quest.';
      stepsDiv.classList.remove('hidden');
      if (backButton) backButton.classList.remove('hidden');
      if (overviewDiv) {
        overviewDiv.innerHTML = '';
        overviewDiv.classList.add('hidden');
      }
      state.currentItems = [];
      state.currentQuestKey = null;
      state.currentKartographerLiveData = null;
      state.showSteps = false;
      setLoading(false);
      hideActionBars(navBar, filterToggle);
      toggleButton.classList.add('hidden');
      if (viewStepsToggle) viewStepsToggle.classList.add('hidden');
      if (viewModeToggle) viewModeToggle.classList.add('hidden');
      if (stickyBar) stickyBar.classList.add('hidden');
      if (progressIndicator) progressIndicator.classList.add('hidden');
      showSearchControls(toggleBar);
      return;
    }

    if (data.parse.displaytitle) {
      const temp = document.createElement('div');
      temp.innerHTML = data.parse.displaytitle;
      finalTitle = temp.textContent.trim();
    } else if (data.parse.title) {
      finalTitle = data.parse.title;
    }

    const html = data.parse.text['*'];
    const iconSrc = getQuestIcon(html);
    state.currentRewardImage = getRewardImage(html);
    state.currentOverview = getQuestOverview(html);
    state.currentKartographerLiveData = data?.parse?.jsconfigvars?.wgKartographerLiveData || null;
    renderTitle(finalTitle, iconSrc);
    if (wikiLink) {
      wikiLink.href = buildWikiHref(resolved.baseTitle || finalTitle, resolved.guideMode);
    }

    const items = extractQuickGuide(html);
    state.currentItems = items;
    state.currentQuestKey = `questProgress:${finalTitle}`;

    const saved = loadProgress();
    if (saved && Array.isArray(saved.checkedIndices)) {
      applyCheckedIndices(state.currentItems, saved.checkedIndices);
    }
    if (saved && saved.overviewChecks && typeof saved.overviewChecks === 'object') {
      state.overviewChecks = saved.overviewChecks;
    }

    const playerMeta = state?.playerQuestMeta || {};
    const lookupKeys = buildQuestMetaLookupKeys([
      finalTitle,
      resolved.baseTitle,
      questName,
      data.parse?.title,
    ]);
    const metaMatch = lookupKeys
      .map((key) => playerMeta[key])
      .find((meta) => meta && typeof meta.status === 'string');
    const isCompletedByPlayer =
      String(metaMatch?.status || '')
        .trim()
        .toLowerCase() === 'completed';
    if (isCompletedByPlayer) {
      state.currentItems.forEach((item) => {
        if (item.type === 'step') item.checked = true;
      });
      saveProgress();
    }

    if (renderOverviewWithState) {
      renderOverviewWithState(state.currentOverview, overviewDiv);
      if (overviewDiv) {
        overviewDiv.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }

    renderSteps(buildStepsRenderParams(items));
    if (viewStepsToggle && setQuestViewMode) {
      viewStepsToggle.classList.remove('hidden');
      viewStepsToggle.onclick = () => setQuestViewMode(!state.showSteps);
    }
    if (viewModeToggle) viewModeToggle.classList.remove('hidden');
    if (stickyBar) stickyBar.classList.add('hidden');
    if (setQuestViewMode) {
      setQuestViewMode(false);
    }
    toggleButton.classList.remove('hidden');
    if (backButton) backButton.classList.remove('hidden');
    updateProgress();
    ctx.input.value = '';
  } catch (err) {
    stepsDiv.innerHTML = 'Error loading quest.';
    console.error(err);
    state.currentKartographerLiveData = null;
    hideActionBars(navBar, filterToggle);
    toggleButton.classList.add('hidden');
    if (viewStepsToggle) viewStepsToggle.classList.add('hidden');
    if (viewModeToggle) viewModeToggle.classList.add('hidden');
    if (stickyBar) stickyBar.classList.add('hidden');
    state.showSteps = false;
    showSearchControls(toggleBar);
  } finally {
    setLoading(false);
  }
}
