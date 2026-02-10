import {
  extractQuickGuide,
  getQuestIcon,
  getRewardImage,
  getQuestOverview,
} from './questParser.js';
import { renderSteps } from './questRender.js';
import { showSearchControls, hideActionBars, showToggleBar } from '../../shared/ui/uiControls.js';

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

export async function resolveQuestTitle(input, onWikiDebug) {
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

export async function loadQuest(questName, ctx) {
  const {
    stepsDiv,
    overviewDiv,
    renderOverview,
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
    hideCompletedCheckbox,
    toggleBar,
    headerEl,
    wikiLink,
    applyCheckedIndices,
    loadProgress,
    buildStepsRenderParams,
    state,
    backButton,
    saveProgress,
    updateProgress,
    onWikiDebug,
  } = ctx;

  renderStepsSkeleton(stepsDiv);
  renderTitle(questName, null);
  updateToggleState(state.showAllSteps);
  setLoading(true);
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
    const resolvedTitle = await resolveQuestTitle(questName, onWikiDebug);
    let finalTitle = resolvedTitle || questName;

    if (!resolvedTitle) {
      stepsDiv.innerHTML = 'Quest not found.';
      stepsDiv.classList.remove('hidden');
      if (backButton) backButton.classList.remove('hidden');
      state.currentItems = [];
      state.currentQuestKey = null;
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
    if (headerEl) {
      headerEl.classList.add('hidden');
    }

    const page = resolvedTitle.replace(/\s+/g, '_') + '/Quick_guide';

    const url =
      'https://runescape.wiki/api.php' +
      '?action=parse' +
      '&format=json' +
      '&origin=*' +
      '&page=' +
      encodeURIComponent(page) +
      '&prop=text';

    const data = await fetchJsonWithTimeoutRetry(url, {
      timeoutMs: 7000,
      retries: 1,
      retryDelayMs: 300,
    });
    if (!data.parse || !data.parse.text) {
      stepsDiv.innerHTML = 'Quick guide not available for this quest.';
      stepsDiv.classList.remove('hidden');
      if (backButton) backButton.classList.remove('hidden');
      if (overviewDiv) {
        overviewDiv.innerHTML = '';
        overviewDiv.classList.add('hidden');
      }
      state.currentItems = [];
      state.currentQuestKey = null;
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
    renderTitle(finalTitle, iconSrc);
    if (wikiLink) {
      const page = finalTitle.replace(/\s+/g, '_');
      wikiLink.href = `https://runescape.wiki/w/${encodeURIComponent(page)}`;
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
    showToggleBar(toggleBar);
    if (toggleBar) toggleBar.classList.add('search-closed');
    toggleButton.classList.remove('hidden');
    if (backButton) backButton.classList.remove('hidden');
    updateProgress();
    ctx.input.value = '';
  } catch (err) {
    stepsDiv.innerHTML = 'Error loading quest.';
    console.error(err);
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
