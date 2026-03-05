import { loadQuestList, getQuestList } from './features/quests/questList.js';
import { formatStepHtml } from './features/quests/questParser.js';
import { renderSearchResults, renderSteps, renderOverview } from './features/quests/questRender.js';
import {
  showSearchControls,
  hideSearchControls,
  showMessage,
  showSearchOnlyView,
  showQuestView,
  bindSearchEvents,
  bindQuestControls,
} from './shared/ui/uiControls.js';
import { state } from './app/state/state.js';
import { loadQuest } from './features/quests/questService.js';
import { translateStepHtmlToPtBr } from './features/quests/questTranslate.js';
import { returnToHome } from './app/flow/appFlow.js';
import { createPlayerService, normalizeTitleKey } from './features/player/playerService.js';
import { getAppElements } from './shared/dom/elements.js';
import { createPlayerController } from './app/controllers/playerController.js';
import { createSearchController } from './app/controllers/searchController.js';
import { createQuestController } from './app/controllers/questController.js';
import { bootstrapApp } from './app/bootstrap/appBootstrap.js';
import { getFilteredResults as filterQuestResults } from './features/search/searchService.js';
import {
  applyCheckedIndices as applyCheckedIndicesToItems,
  saveProgress as saveQuestProgress,
  loadProgress as loadQuestProgress,
  loadUiPreferences as loadUiPrefs,
  saveUiPreferences as saveUiPrefs,
} from './features/progress/progressService.js';

// Basic check
// if (!window.alt1) {
//   alert('Open this app inside the Alt1 Toolkit!');
// }

const {
  settingsButton,
  settingsButtonQuest,
  settingsPanel,
  sequentialStepToggleWrap,
  sequentialStepToggle,
  input,
  playerInput,
  playerLookupButton,
  seriesFilter,
  toggleButton,
  searchToggleButton,
  backButton,
  stepsDiv,
  titleDiv,
  overviewDiv,
  viewStepsToggle,
  viewModeToggle,
  hideCompletedCheckbox,
  resultsDiv,
  progressIndicator,
  progressRow,
  wikiLink,
  prevStepButton,
  nextStepButton,
  resetQuestButton,
  jumpCurrentButton,
  headerEl,
  navBar,
  questTranslateButton,
  toggleBar,
  playerBar,
  stickyBar,
  scrollTopButton,
} = getAppElements();
const filterToggle = document.getElementById('filterToggle') || hideCompletedCheckbox;
const navLeft = navBar ? navBar.querySelector('.nav-left') : null;
const settingsCloseButton = document.getElementById('settingsCloseButton');
const autoTranslateToggle = document.getElementById('autoTranslateToggle');
const autoTranslateToggleWrap = document.getElementById('autoTranslateToggleWrap');
const confirmResetToggle = document.getElementById('confirmResetToggle');
const confirmResetToggleWrap = document.getElementById('confirmResetToggleWrap');
const stepFontSizeSelect = document.getElementById('stepFontSizeSelect');
let lastSettingsTrigger = null;

const resultsBatchSize = 20;
const resultsRefs = { observer: null, sentinel: null };
let toastTimer = null;
let progressFlashTimer = null;
let confirmResolver = null;
const uiPrefsKey = 'uiPreferences';
const playerService = createPlayerService();

const normalizeQuestLookupKey = (title) =>
  String(title || '')
    .replace(/\/\s*quick[_\s-]*guide\b/gi, '')
    .replace(/\bquick[_\s-]*guide\b/gi, '')
    .replace(/[\u2018\u2019´]/g, "'")
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const resolveQuestTitleFromAppList = (candidateTitle) => {
  const lookupKey = normalizeQuestLookupKey(candidateTitle);
  if (!lookupKey) return null;
  const match = getQuestList().find((item) => normalizeQuestLookupKey(item?.title) === lookupKey);
  return match && match.title ? match.title : null;
};

const getLocalProgressQuestMeta = () => {
  const out = {};
  const prefix = 'questProgress:';
  const keys = [];
  try {
    if (
      localStorage &&
      typeof localStorage.length === 'number' &&
      typeof localStorage.key === 'function'
    ) {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
    } else {
      keys.push(...Object.keys(localStorage || {}));
    }
  } catch (_err) {
    // ignore key enumeration failures
  }

  keys.forEach((key) => {
    if (!key || !key.startsWith(prefix)) return;
    const questTitle = key.slice(prefix.length).trim();
    if (!questTitle) return;

    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(key) || 'null');
    } catch (_err) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return;

    const checkedSteps = Number(parsed?.stepProgress?.checkedSteps);
    const totalSteps = Number(parsed?.stepProgress?.totalSteps);
    const checkedIndicesLen = Array.isArray(parsed?.checkedIndices)
      ? parsed.checkedIndices.length
      : 0;

    let status = '';
    if (Number.isFinite(totalSteps) && totalSteps > 0 && Number.isFinite(checkedSteps)) {
      status = checkedSteps >= totalSteps ? 'completed' : checkedSteps > 0 ? 'started' : '';
    } else if (checkedIndicesLen > 0) {
      status = 'started';
    }
    if (!status) return;
    const resolvedTitle = resolveQuestTitleFromAppList(questTitle) || questTitle;
    out[normalizeTitleKey(resolvedTitle)] = { status };
  });

  return out;
};

const hasActivePlayerLookup = () =>
  state.playerQuestFilter !== null ||
  Boolean(String(state.playerName || '').trim()) ||
  Object.keys(state.playerQuestMeta || {}).length > 0;

// State helpers
const getFilteredResults = () =>
  filterQuestResults({
    questList: getQuestList(),
    playerQuestFilter: state.playerQuestFilter,
    playerQuestMeta: hasActivePlayerLookup() ? state.playerQuestMeta : getLocalProgressQuestMeta(),
    searchQuery: state.searchQuery,
    selectedSeries: state.selectedSeries,
    normalizeTitleKey,
  });

const saveProgress = () => {
  saveQuestProgress({
    storage: localStorage,
    questKey: state.currentQuestKey,
    items: state.currentItems,
    overviewChecks: state.overviewChecks,
  });
};

const loadProgress = () => {
  return loadQuestProgress({
    storage: localStorage,
    questKey: state.currentQuestKey,
  });
};

const loadUiPreferences = () => {
  return loadUiPrefs({ storage: localStorage, key: uiPrefsKey });
};

const saveUiPreferences = () => {
  saveUiPrefs({
    storage: localStorage,
    key: uiPrefsKey,
    showAllSteps: state.showAllSteps,
    hideCompleted: !!(hideCompletedCheckbox && hideCompletedCheckbox.checked),
    sequentialStepChecking: !!state.sequentialStepChecking,
    autoTranslateSteps: !!state.autoTranslateSteps,
    stepFontSize: state.stepFontSize || 'medium',
    confirmResetQuestProgress: !!state.confirmResetQuestProgress,
  });
};

const updateProgress = () => {
  if (!progressIndicator) return;
  const total = state.currentItems.filter((i) => i.type === 'step').length;
  const done = state.currentItems.filter((i) => i.type === 'step' && i.checked).length;
  if (total === 0) {
    progressIndicator.classList.add('hidden');
    progressIndicator.classList.remove('complete', 'complete-flash');
    if (progressFlashTimer) {
      clearTimeout(progressFlashTimer);
      progressFlashTimer = null;
    }
    return;
  }
  const percent = Math.round((done / total) * 100);
  let fillEl = progressIndicator.querySelector('.progress-fill');
  let labelEl = progressIndicator.querySelector('.progress-label');
  if (!fillEl || !labelEl) {
    progressIndicator.innerHTML = '';
    fillEl = document.createElement('span');
    fillEl.className = 'progress-fill';
    labelEl = document.createElement('span');
    labelEl.className = 'progress-label';
    progressIndicator.appendChild(fillEl);
    progressIndicator.appendChild(labelEl);
  }
  labelEl.textContent = `${done} / ${total}`;
  fillEl.style.width = `${percent}%`;
  const wasComplete = progressIndicator.classList.contains('complete');
  const isComplete = done === total;
  progressIndicator.classList.toggle('complete', isComplete);
  if (isComplete && !wasComplete) {
    progressIndicator.classList.add('complete-flash');
    if (progressFlashTimer) clearTimeout(progressFlashTimer);
    progressFlashTimer = setTimeout(() => {
      progressIndicator.classList.remove('complete-flash');
      progressFlashTimer = null;
    }, 420);
  }
  progressIndicator.classList.remove('hidden');
  progressIndicator.setAttribute('role', 'progressbar');
  progressIndicator.setAttribute('aria-label', 'Quest progress');
  progressIndicator.setAttribute('aria-valuemin', '0');
  progressIndicator.setAttribute('aria-valuemax', String(total));
  progressIndicator.setAttribute('aria-valuenow', String(done));
  progressIndicator.setAttribute('aria-valuetext', `${percent}% complete`);
};

const initHideCompletedToggle = (initialValue = false) => {
  if (!hideCompletedCheckbox) return;
  Object.defineProperty(hideCompletedCheckbox, 'checked', {
    configurable: true,
    get() {
      return this.dataset.checked === 'true';
    },
    set(value) {
      const next = Boolean(value);
      this.dataset.checked = next ? 'true' : 'false';
      this.setAttribute('aria-pressed', next ? 'true' : 'false');
      this.classList.toggle('active', next);
      this.title = next ? 'Show completed steps in the list' : 'Hide completed steps from the list';
      this.setAttribute(
        'aria-label',
        next ? 'Show completed steps in the list' : 'Hide completed steps from the list'
      );
      this.innerHTML = `<span class="material-symbols-outlined">${
        next ? 'visibility_off' : 'visibility'
      }</span>`;
    },
  });
  hideCompletedCheckbox.checked = Boolean(initialValue);
};

const updateSequentialStepToggleUi = () => {
  if (!sequentialStepToggle) return;
  const enabled = !!state.sequentialStepChecking;
  sequentialStepToggle.checked = enabled;
  if (sequentialStepToggleWrap) {
    sequentialStepToggleWrap.title = enabled
      ? 'When enabled, checking a step also checks previous steps'
      : 'When disabled, each step can be checked freely';
  } else {
    sequentialStepToggle.title = enabled
      ? 'When enabled, checking a step also checks previous steps'
      : 'When disabled, each step can be checked freely';
  }
};

const initSequentialStepToggle = (initialValue = true) => {
  state.sequentialStepChecking = Boolean(initialValue);
  updateSequentialStepToggleUi();
};

const normalizeStepFontSize = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'small' || normalized === 'large') return normalized;
  return 'medium';
};

const applyStepFontSize = (value) => {
  const nextValue = normalizeStepFontSize(value);
  state.stepFontSize = nextValue;
  if (stepsDiv) {
    stepsDiv.dataset.stepFontSize = nextValue;
  }
  if (stepFontSizeSelect) {
    stepFontSizeSelect.value = nextValue;
  }
};

const initAdvancedSettingsUi = (prefs = {}) => {
  state.autoTranslateSteps = Boolean(prefs.autoTranslateSteps);
  state.confirmResetQuestProgress =
    typeof prefs.confirmResetQuestProgress === 'boolean' ? prefs.confirmResetQuestProgress : true;
  applyStepFontSize(prefs.stepFontSize || 'medium');

  if (autoTranslateToggle) {
    autoTranslateToggle.checked = state.autoTranslateSteps;
  }
  if (autoTranslateToggleWrap) {
    autoTranslateToggleWrap.title = state.autoTranslateSteps
      ? 'Automatically translates quest steps when opening Steps view'
      : 'Enable to auto-translate steps when opening Steps view';
  }
  if (confirmResetToggle) {
    confirmResetToggle.checked = state.confirmResetQuestProgress;
  }
  if (confirmResetToggleWrap) {
    confirmResetToggleWrap.title = state.confirmResetQuestProgress
      ? 'Ask confirmation before resetting quest progress'
      : 'Reset quest progress immediately';
  }
};

const updateTopBarsStickyState = () => {
  if (navBar) {
    const shouldStickNav =
      state.showSteps && state.showAllSteps && !navBar.classList.contains('hidden');
    navBar.classList.toggle('sticky-top', shouldStickNav);
    if (progressRow) {
      progressRow.classList.toggle('sticky-top', shouldStickNav);
      progressRow.style.top = shouldStickNav ? `${navBar.offsetHeight}px` : '0';
    }
  }
  if (viewModeToggle) {
    const shouldStickOverview = !state.showSteps && !viewModeToggle.classList.contains('hidden');
    viewModeToggle.classList.toggle('sticky-top', shouldStickOverview);
  }
  updateBackButtonPlacement();
  updateQuestTranslateButtonVisibility();
};

const isNavCurrentlyStuck = () => {
  if (!navBar || navBar.classList.contains('hidden')) return false;
  if (!navBar.classList.contains('sticky-top')) return false;
  const rect = navBar.getBoundingClientRect();
  return rect.top <= 0 && rect.bottom > 0;
};

const updateBackButtonPlacement = () => {
  if (!backButton || !viewModeToggle) return;
  const shouldPlaceInNav = Boolean(
    navLeft &&
    state.showSteps &&
    state.showAllSteps &&
    !backButton.classList.contains('hidden') &&
    isNavCurrentlyStuck()
  );
  const target = shouldPlaceInNav && navLeft ? navLeft : viewModeToggle;
  if (!target || backButton.parentElement === target) return;
  target.insertBefore(backButton, target.firstChild);
};

const createEmptyQuestTranslationState = () => ({
  isTranslated: false,
  isLoading: false,
  hasError: false,
  originalHtml: [],
  translatedHtml: [],
});

const ensureQuestTranslationState = () => {
  if (!state.questTranslation || typeof state.questTranslation !== 'object') {
    state.questTranslation = createEmptyQuestTranslationState();
  }
  return state.questTranslation;
};

const walkSubsteps = (substeps, visit) => {
  if (!Array.isArray(substeps) || typeof visit !== 'function') return;
  substeps.forEach((substep) => {
    if (!substep || typeof substep !== 'object') return;
    visit(substep);
    walkSubsteps(substep.substeps, visit);
  });
};

const htmlToText = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const collectTranslatableEntries = (items) => {
  const entries = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'title') {
      entries.push({
        get: () => String(item.text || '').trim(),
        set: (value) => {
          item.text = String(value || '').trim();
        },
        textHint: String(item.text || '').trim(),
      });
      if (Array.isArray(item.seeAlso)) {
        item.seeAlso.forEach((_value, seeAlsoIndex) => {
          entries.push({
            get: () => String(item.seeAlso?.[seeAlsoIndex] || '').trim(),
            set: (value) => {
              if (!Array.isArray(item.seeAlso)) item.seeAlso = [];
              item.seeAlso[seeAlsoIndex] = String(value || '').trim();
            },
            textHint: htmlToText(item.seeAlso?.[seeAlsoIndex]),
          });
        });
      }
      return;
    }
    if (item.type !== 'step') return;
    entries.push({
      get: () => String(item.html || item.text || '').trim(),
      set: (value) => {
        item.html = String(value || '').trim();
      },
      textHint: String(item.text || '').trim(),
    });
    walkSubsteps(item.substeps, (substep) => {
      entries.push({
        get: () => String(substep.html || substep.text || '').trim(),
        set: (value) => {
          substep.html = String(value || '').trim();
        },
        textHint: String(substep.text || '').trim(),
      });
    });
  });
  return entries;
};

const applyValueListToEntries = (entries, valueList) => {
  if (!Array.isArray(entries) || !Array.isArray(valueList)) return;
  entries.forEach((entry, index) => {
    if (!entry || typeof entry.set !== 'function') return;
    entry.set(String(valueList[index] || '').trim());
  });
};

const setQuestTranslateButtonState = () => {
  if (!questTranslateButton) return;
  const translationState = ensureQuestTranslationState();
  const icon = translationState.isLoading ? 'hourglass_top' : 'g_translate';
  questTranslateButton.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
  questTranslateButton.disabled = translationState.isLoading;
  questTranslateButton.classList.toggle('loading', translationState.isLoading);
  questTranslateButton.classList.toggle('translated', translationState.isTranslated);
  questTranslateButton.classList.toggle('error', translationState.hasError);
  const label = translationState.isTranslated
    ? 'Restore original quest steps'
    : 'Translate quest steps to PT-BR';
  questTranslateButton.title = label;
  questTranslateButton.setAttribute('aria-label', label);
};

const updateQuestTranslateButtonVisibility = () => {
  if (!questTranslateButton) return;
  setQuestTranslateButtonState();
  const hasStep = state.currentItems.some((item) => item?.type === 'step');
  const shouldShow =
    hasStep &&
    !!state.showSteps &&
    !!backButton &&
    !backButton.classList.contains('hidden') &&
    !!navBar &&
    !navBar.classList.contains('hidden');
  questTranslateButton.classList.toggle('hidden', !shouldShow);
};

const toggleQuestTranslation = async () => {
  if (!state.currentItems.length) return;
  const translationState = ensureQuestTranslationState();
  if (translationState.isLoading) return;
  const entries = collectTranslatableEntries(state.currentItems);
  if (!entries.length) return;

  if (
    !Array.isArray(translationState.originalHtml) ||
    translationState.originalHtml.length !== entries.length
  ) {
    translationState.originalHtml = entries.map((entry) => String(entry.get?.() || '').trim());
  }

  if (translationState.isTranslated) {
    applyValueListToEntries(entries, translationState.originalHtml);
    translationState.isTranslated = false;
    translationState.hasError = false;
    renderSteps(buildStepsRenderParams(state.currentItems));
    setQuestTranslateButtonState();
    return;
  }

  translationState.isLoading = true;
  translationState.hasError = false;
  setQuestTranslateButtonState();
  try {
    let translatedHtml = translationState.translatedHtml;
    if (!Array.isArray(translatedHtml) || translatedHtml.length !== entries.length) {
      translatedHtml = [];
      for (const entry of entries) {
        const sourceHtml = String(entry.get?.() || '').trim();
        if (!sourceHtml) {
          translatedHtml.push(sourceHtml);
          continue;
        }
        const textHint = String(entry.textHint || '').trim() || htmlToText(sourceHtml);
        const translated = await translateStepHtmlToPtBr({
          html: sourceHtml,
          text: textHint,
          targetLang: 'pt-BR',
        });
        const translatedText = String(translated || '').trim();
        translatedHtml.push(translatedText || sourceHtml);
      }
      translationState.translatedHtml = translatedHtml;
    }
    applyValueListToEntries(entries, translatedHtml);
    translationState.isTranslated = true;
    renderSteps(buildStepsRenderParams(state.currentItems));
  } catch (_err) {
    translationState.hasError = true;
    showUiToast('Translation failed', { type: 'error' });
  } finally {
    translationState.isLoading = false;
    setQuestTranslateButtonState();
  }
};

const resetSearchInput = () => {
  if (input) input.value = '';
};

const ensureUiToast = () => {
  let toast = document.getElementById('uiToast');
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = 'uiToast';
  toast.className = 'ui-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toast);
  return toast;
};

const showUiToast = (message, options = {}) => {
  if (!message) return;
  const { position = 'bottom-right', type = 'default' } = options;
  const toast = ensureUiToast();
  toast.classList.remove('top-right', 'success', 'error');
  if (position === 'top-right') {
    toast.classList.add('top-right');
  }
  if (type === 'success' || type === 'error') {
    toast.classList.add(type);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 1400);
};

const ensureConfirmDialog = () => {
  let dialog = document.getElementById('appConfirmDialog');
  if (dialog) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'appConfirmDialog';
  dialog.className = 'app-confirm hidden';
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML = `
    <div class="app-confirm-card" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle">
      <h3 id="appConfirmTitle">Confirm</h3>
      <p id="appConfirmMessage"></p>
      <div class="app-confirm-actions">
        <button id="appConfirmCancel" type="button" class="app-confirm-btn">Cancel</button>
        <button id="appConfirmOk" type="button" class="app-confirm-btn app-confirm-btn-danger">Reset</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
};

const closeConfirmDialog = (result = false) => {
  const dialog = document.getElementById('appConfirmDialog');
  if (!dialog) return;
  dialog.classList.add('hidden');
  dialog.setAttribute('aria-hidden', 'true');
  if (typeof confirmResolver === 'function') {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(Boolean(result));
  }
};

const askConfirm = (message) =>
  new Promise((resolve) => {
    const dialog = ensureConfirmDialog();
    const messageEl = dialog.querySelector('#appConfirmMessage');
    const okBtn = dialog.querySelector('#appConfirmOk');
    const cancelBtn = dialog.querySelector('#appConfirmCancel');
    if (messageEl) messageEl.textContent = String(message || 'Are you sure?');
    confirmResolver = resolve;
    dialog.classList.remove('hidden');
    dialog.setAttribute('aria-hidden', 'false');

    const onBackdropClick = (event) => {
      if (event.target === dialog) closeConfirmDialog(false);
    };
    const onKeyDown = (event) => {
      if (dialog.classList.contains('hidden')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmDialog(false);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        closeConfirmDialog(true);
      }
    };
    dialog.addEventListener('click', onBackdropClick, { once: true });
    document.addEventListener('keydown', onKeyDown, { once: true });
    if (cancelBtn) {
      cancelBtn.onclick = () => closeConfirmDialog(false);
    }
    if (okBtn) {
      okBtn.onclick = () => closeConfirmDialog(true);
      okBtn.focus();
    }
  });

const openSettingsModal = (triggerEl = null) => {
  if (!settingsPanel) return;
  lastSettingsTrigger = triggerEl || lastSettingsTrigger || document.activeElement;
  settingsPanel.classList.remove('hidden');
  settingsPanel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  if (settingsButton) settingsButton.setAttribute('aria-expanded', 'true');
  if (settingsButtonQuest) settingsButtonQuest.setAttribute('aria-expanded', 'true');
  if (settingsCloseButton) {
    settingsCloseButton.focus();
  } else if (sequentialStepToggle) {
    sequentialStepToggle.focus();
  }
};

const closeSettingsModal = ({ restoreFocus = true } = {}) => {
  if (!settingsPanel) return;
  settingsPanel.classList.add('hidden');
  settingsPanel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (settingsButton) settingsButton.setAttribute('aria-expanded', 'false');
  if (settingsButtonQuest) settingsButtonQuest.setAttribute('aria-expanded', 'false');
  if (restoreFocus) {
    const focusTarget =
      lastSettingsTrigger instanceof HTMLElement ? lastSettingsTrigger : settingsButton;
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
  }
};

const toggleSettingsModal = () => {
  if (!settingsPanel) return;
  const willOpen = settingsPanel.classList.contains('hidden');
  if (willOpen) {
    openSettingsModal(lastSettingsTrigger);
    return;
  }
  closeSettingsModal({ restoreFocus: false });
};

const renderTitle = (titleText, iconSrc) => {
  if (!titleText) {
    titleDiv.innerHTML = '';
    titleDiv.classList.add('hidden');
    if (wikiLink) wikiLink.href = '#';
    return;
  }
  titleDiv.classList.remove('hidden');
  titleDiv.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'title-text';
  span.textContent = titleText || '';
  titleDiv.appendChild(span);

  const titleLookupKey = normalizeQuestLookupKey(titleText);
  const questMeta = getQuestList().find(
    (item) => normalizeQuestLookupKey(item?.title) === titleLookupKey
  );
  if (questMeta && questMeta.membersIcon) {
    const membersImg = document.createElement('img');
    membersImg.className = 'quest-members-icon';
    membersImg.src = questMeta.membersIcon;
    const membership = String(questMeta.membership || '').toLowerCase();
    membersImg.alt = membership === 'free' ? 'Free-to-play' : 'Members';
    titleDiv.appendChild(membersImg);
  }

  if (iconSrc) {
    const img = document.createElement('img');
    img.className = 'quest-icon';
    img.src = iconSrc;
    img.alt = '';
    titleDiv.appendChild(img);
  }
};

// Render helpers
const buildSearchRenderParams = (reset) => {
  state.searchState.reset = reset;
  return {
    resultsDiv,
    getFilteredResults,
    resultsBatchSize,
    searchState: state.searchState,
    createRowContext: {
      resultsDiv,
      input,
      clearSearchResults,
      loadQuest: (name) => loadQuest(name, buildQuestContext()),
    },
    groupMode: state.selectedSeries,
    ensureSentinel: () => {
      if (!resultsRefs.sentinel) {
        resultsRefs.sentinel = document.createElement('div');
        resultsRefs.sentinel.className = 'results-sentinel';
      }
      if (!resultsDiv.contains(resultsRefs.sentinel)) {
        resultsDiv.appendChild(resultsRefs.sentinel);
      }
      if (resultsRefs.observer && resultsRefs.sentinel) {
        resultsRefs.observer.observe(resultsRefs.sentinel);
      }
    },
    afterRender: () => {},
  };
};

const buildStepsRenderParams = (items) => ({
  items,
  stepsDiv,
  showAllSteps: state.showAllSteps,
  sequentialStepChecking: state.sequentialStepChecking,
  hideCompletedCheckbox,
  filterToggle,
  navBar,
  prevStepButton,
  nextStepButton,
  jumpCurrentButton,
  currentRewardImage: state.currentRewardImage,
  overviewStartPointHtml: state.currentOverview?.startPoint || '',
  kartographerLiveData: state.currentKartographerLiveData,
  pendingAutoScroll: () => state.pendingAutoScroll,
  setPendingAutoScroll: (val) => {
    state.pendingAutoScroll = val;
  },
  focusedStepIndex: state.focusedStepIndex,
  setFocusedStepIndex: (val) => {
    state.focusedStepIndex = Number.isInteger(val) ? val : null;
  },
  saveProgress,
  renderStepsFn: (nextItems) => renderSteps(buildStepsRenderParams(nextItems)),
  formatStepHtml,
  updateProgress,
  resetQuestButton,
  onResetQuest: handleResetQuestAction,
  currentItems: state.currentItems,
  showSearchControls: () => showSearchControls(toggleBar),
});

const renderOverviewWithCurrentState = (overview, target) =>
  renderOverview(overview, target, {
    savedChecks: state.overviewChecks,
    playerQuestMeta: state.playerQuestMeta,
    playerSkills: state.playerSkills,
    onQuestNavigate: (questName) => {
      const appQuestTitle = resolveQuestTitleFromAppList(questName);
      if (!appQuestTitle) {
        showUiToast('This entry is not a quest in the app list.', {
          position: 'top-right',
          type: 'error',
        });
        return;
      }
      loadQuest(appQuestTitle, buildQuestContext());
    },
    onToggle: (key, checked) => {
      state.overviewChecks = {
        ...(state.overviewChecks || {}),
        [key]: checked,
      };
      saveProgress();
    },
  });

const refreshActiveQuestOverview = () => {
  if (!state.currentQuestKey || !state.currentOverview || !overviewDiv) return;
  renderOverviewWithCurrentState(state.currentOverview, overviewDiv);
  if (state.showSteps) {
    overviewDiv.classList.add('hidden');
    if (stepsDiv) stepsDiv.classList.remove('hidden');
  }
};

const setPlayerLookupLoading = (isLoading) => {
  if (!playerLookupButton) return;
  playerLookupButton.classList.toggle('loading', isLoading);
  playerLookupButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  playerLookupButton.disabled = isLoading;
};

const isElementInViewport = (el) => {
  if (!el || el.classList.contains('hidden')) return false;
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  return rect.bottom > 0 && rect.top < vh;
};

const updateScrollTopButtonVisibility = () => {
  if (!scrollTopButton) return;
  const inQuestStepsView =
    !!state.showSteps &&
    !!backButton &&
    !backButton.classList.contains('hidden') &&
    !!stickyBar &&
    !stickyBar.classList.contains('hidden');
  const topAreaVisible = isElementInViewport(headerEl) || isElementInViewport(titleDiv);
  const shouldShow = inQuestStepsView && !topAreaVisible && window.scrollY > 0;
  scrollTopButton.classList.toggle('hidden', !shouldShow);
};

const refreshQuestListForCurrentView = () => {
  const isInsideQuest = backButton && !backButton.classList.contains('hidden');
  if (isInsideQuest) {
    hideSearchResults();
    return;
  }
  renderSearchResults(buildSearchRenderParams(true));
};

const resetCurrentQuestProgress = () => {
  if (!state.currentItems.length) return false;
  state.focusedStepIndex = null;
  state.currentItems.forEach((item) => {
    if (item.type === 'step') item.checked = false;
  });
  saveProgress();
  renderSteps(buildStepsRenderParams(state.currentItems));
  return true;
};

const handleResetQuestAction = async () => {
  if (!state.currentItems.length) return;
  if (state.confirmResetQuestProgress) {
    const confirmed = await askConfirm('Reset all step progress for this quest?');
    if (!confirmed) return;
  }
  if (resetCurrentQuestProgress()) {
    showUiToast('Quest progress reset');
  }
};

// Context builders
const buildQuestContext = () => ({
  stepsDiv,
  overviewDiv,
  viewStepsToggle,
  viewModeToggle,
  hideSearchResults,
  setQuestViewMode: (showSteps) => {
    state.showSteps = showSteps;
    if (navBar) navBar.classList.remove('hidden');
    hideSearchResults();
    if (showSteps) {
      updateToggleState(state.showAllSteps);
      if (viewModeToggle) viewModeToggle.classList.remove('hidden');
      if (viewModeToggle) viewModeToggle.classList.add('active');
      if (stickyBar) stickyBar.classList.remove('hidden');
      if (stepsDiv) stepsDiv.classList.remove('hidden');
      if (overviewDiv) overviewDiv.classList.add('hidden');
      if (toggleButton) toggleButton.classList.remove('hidden');
      if (toggleButton) toggleButton.disabled = false;
      if (prevStepButton) prevStepButton.classList.remove('hidden');
      if (nextStepButton) nextStepButton.classList.remove('hidden');
      if (jumpCurrentButton) {
        if (state.showAllSteps) {
          jumpCurrentButton.classList.remove('hidden');
        } else {
          jumpCurrentButton.classList.add('hidden');
        }
      }
      if (progressIndicator) progressIndicator.classList.remove('hidden');
      if (filterToggle) {
        if (state.showAllSteps) {
          filterToggle.classList.remove('hidden');
        } else {
          filterToggle.classList.add('hidden');
        }
      }
      updateProgress();
      if (viewStepsToggle) {
        viewStepsToggle.classList.add('active');
        const icon = viewStepsToggle.querySelector('.material-symbols-outlined');
        const label = viewStepsToggle.querySelector('.view-toggle-label');
        if (icon) icon.textContent = 'description';
        if (label) label.textContent = 'Overview';
      }
      if (viewModeToggle) {
        const modeLabel = viewModeToggle.querySelector('.mode-label');
        if (modeLabel) modeLabel.textContent = 'Steps';
      }
      if (toggleButton) toggleButton.title = 'Show only the current step';
      if (state.currentItems.length > 0) {
        renderSteps(buildStepsRenderParams(state.currentItems));
        applyStepFontSize(state.stepFontSize);
        if (state.autoTranslateSteps) {
          const translationState = ensureQuestTranslationState();
          if (!translationState.isTranslated && !translationState.isLoading) {
            toggleQuestTranslation();
          }
        }
      }
    } else {
      if (viewModeToggle) viewModeToggle.classList.remove('hidden');
      if (viewModeToggle) viewModeToggle.classList.remove('active');
      if (navBar) navBar.classList.add('hidden');
      if (stickyBar) stickyBar.classList.add('hidden');
      if (stepsDiv) stepsDiv.classList.add('hidden');
      if (overviewDiv) overviewDiv.classList.remove('hidden');
      if (toggleButton) {
        toggleButton.classList.remove('hidden');
        toggleButton.disabled = true;
      }
      if (prevStepButton) prevStepButton.classList.add('hidden');
      if (nextStepButton) nextStepButton.classList.add('hidden');
      if (jumpCurrentButton) jumpCurrentButton.classList.add('hidden');
      if (progressIndicator) progressIndicator.classList.remove('hidden');
      updateProgress();
      if (filterToggle) filterToggle.classList.add('hidden');
      if (viewStepsToggle) {
        viewStepsToggle.classList.remove('active');
        const icon = viewStepsToggle.querySelector('.material-symbols-outlined');
        const label = viewStepsToggle.querySelector('.view-toggle-label');
        if (icon) icon.textContent = 'list';
        if (label) label.textContent = 'Steps';
      }
      if (viewModeToggle) {
        const modeLabel = viewModeToggle.querySelector('.mode-label');
        if (modeLabel) modeLabel.textContent = 'Overview';
      }
      if (toggleButton) {
        toggleButton.title = 'Switch to View Steps to toggle step visibility';
      }
    }
    updateTopBarsStickyState();
    updateScrollTopButtonVisibility();
  },
  renderOverview,
  renderOverviewWithState: (overview, target) => renderOverviewWithCurrentState(overview, target),
  renderTitle,
  updateToggleState,
  setLoading,
  navBar,
  filterToggle,
  stickyBar,
  clearSearchResults,
  toggleButton,
  progressIndicator,
  hideCompletedCheckbox,
  toggleBar,
  playerBar,
  headerEl,
  wikiLink,
  applyCheckedIndices: applyCheckedIndicesToItems,
  loadProgress,
  buildStepsRenderParams,
  state,
  backButton,
  saveProgress,
  updateProgress,
  input,
  onWikiDebug: showWikiDebugInSearchResults,
});

const buildHomeContext = () => ({
  state,
  updateToggleState,
  toggleButton,
  headerEl,
  renderTitle,
  overviewDiv,
  renderOverview,
  renderOverviewWithState: (overview, target) => renderOverviewWithCurrentState(overview, target),
  clearSearchResults,
  input,
  toggleBar,
  playerBar,
  buildSearchRenderParams,
  navBar,
  filterToggle,
  progressIndicator,
  hideCompletedCheckbox,
  prevStepButton,
  nextStepButton,
  jumpCurrentButton,
  backButton,
  stepsDiv,
  viewModeToggle,
  stickyBar,
});

// UI helpers
const clearSearchResults = () => {
  if (!resultsDiv) return;
  resultsDiv.innerHTML = '';
  resultsDiv.classList.remove('visible');
  resultsDiv.classList.add('hidden');
  state.searchState.visibleResults = 0;
  state.searchState.lastRenderedSeries = null;
  if (backButton && !backButton.classList.contains('hidden')) {
    if (state.showSteps) {
      showQuestView(titleDiv, navBar, stepsDiv);
      if (overviewDiv) overviewDiv.classList.add('hidden');
    } else {
      if (titleDiv && titleDiv.textContent.trim()) {
        titleDiv.classList.remove('hidden');
      }
      if (navBar) navBar.classList.add('hidden');
      if (overviewDiv) overviewDiv.classList.remove('hidden');
      if (stepsDiv) stepsDiv.classList.add('hidden');
    }
  }
  updateScrollTopButtonVisibility();
  updateQuestTranslateButtonVisibility();
};

const hideSearchResults = () => {
  if (!resultsDiv) return;
  resultsDiv.classList.remove('visible');
  resultsDiv.classList.add('hidden');
};

const showWikiDebugInSearchResults = (label, payload) => {
  if (!resultsDiv) return;
  const safeLabel = label || 'Wiki debug';
  let payloadText = '';
  try {
    payloadText = JSON.stringify(payload, null, 2);
  } catch (err) {
    payloadText = String(payload);
  }
  resultsDiv.classList.remove('hidden');
  resultsDiv.classList.add('visible');
  resultsDiv.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'search-item open';
  const header = document.createElement('div');
  header.className = 'search-item-header';
  header.textContent = safeLabel;
  const content = document.createElement('pre');
  content.className = 'search-item-panel';
  content.style.whiteSpace = 'pre-wrap';
  content.style.overflow = 'auto';
  content.textContent = payloadText;
  wrap.appendChild(header);
  wrap.appendChild(content);
  resultsDiv.appendChild(wrap);
};

const showSearchResultsSkeleton = () => {
  if (!resultsDiv) return;
  resultsDiv.classList.remove('hidden');
  resultsDiv.classList.add('visible');
  resultsDiv.innerHTML = `
    <div class="search-skeleton-card">
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta short"></div>
    </div>
    <div class="search-skeleton-card">
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta short"></div>
    </div>
    <div class="search-skeleton-card">
      <div class="loading-skeleton skeleton-line skeleton-title"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta"></div>
      <div class="loading-skeleton skeleton-line skeleton-meta short"></div>
    </div>
  `;
};

const loadPlayerQuests = async (playerName) => {
  const result = await playerService.loadPlayerData(playerName);

  if (result.kind === 'empty') {
    state.playerName = '';
    state.playerQuestFilter = null;
    state.playerQuestMeta = {};
    state.playerSkills = {};
    state.playerLastFetchAt = null;
    refreshActiveQuestOverview();
    refreshQuestListForCurrentView();
    return;
  }

  showSearchResultsSkeleton();
  if (result.kind === 'success') {
    state.playerName = result.username;
    state.playerQuestFilter = result.questFilter;
    state.playerQuestMeta = result.questMeta;
    state.playerSkills = result.skills;
    state.playerLastFetchAt = result.ts;
    refreshActiveQuestOverview();
    refreshQuestListForCurrentView();
    showUiToast('Player data loaded successfully', { position: 'top-right', type: 'success' });
    return;
  }

  state.playerName = result.username || '';
  state.playerQuestFilter = new Set();
  state.playerQuestMeta = {};
  state.playerSkills = {};
  state.playerLastFetchAt = null;
  refreshActiveQuestOverview();
  refreshQuestListForCurrentView();
  if (result.code === 'PROFILE_PRIVATE') {
    showUiToast('This player has a private RuneMetrics profile', { type: 'error' });
  } else if (result.code === 'USER_NOT_FOUND') {
    showUiToast('Player not found', { type: 'error' });
  } else {
    showUiToast('Network error while loading player data', { type: 'error' });
  }
};

// Event handlers
const {
  handleSearchInput,
  handleSeriesFilterChange,
  handleSearchToggle,
  handleSearchEscape,
  handleOutsideClick,
  handleBack,
} = createSearchController({
  input,
  seriesFilter,
  toggleBar,
  backButton,
  titleDiv,
  navBar,
  stepsDiv,
  overviewDiv,
  state,
  filterToggle,
  getQuestList,
  loadQuestList,
  showSearchResultsSkeleton,
  showSearchOnlyView,
  renderSearchResults,
  buildSearchRenderParams,
  showSearchControls,
  hideSearchControls,
  clearSearchResults,
  resetSearchInput,
  showMessage,
  loadQuestFromName: (questName) => loadQuest(questName, buildQuestContext()),
  returnHome: async () => {
    await returnToHome(buildHomeContext());
    updateScrollTopButtonVisibility();
  },
});

const { handlePlayerSubmit, handlePlayerLookup } = createPlayerController({
  getQuestList,
  loadQuestList,
  loadPlayerQuests,
  playerInput,
  setPlayerLookupLoading,
});

// UI state setters
const updateToggleState = (isActive) => {
  state.showAllSteps = isActive;
  toggleButton.classList.toggle('active', state.showAllSteps);
  toggleButton.setAttribute('aria-pressed', state.showAllSteps ? 'true' : 'false');
  toggleButton.setAttribute(
    'aria-label',
    state.showAllSteps ? 'Show current step only' : 'Show all quest steps'
  );
  toggleButton.innerHTML = '<span class="material-symbols-outlined">list_alt</span>';
  toggleButton.title = state.showAllSteps ? 'Show only the current step' : 'Show all quest steps';
  updateTopBarsStickyState();
};

const setLoading = (isLoading) => {
  toggleButton.disabled = isLoading || state.currentItems.length === 0;
  input.disabled = isLoading;
  if (playerInput) playerInput.disabled = isLoading;
  if (playerLookupButton) playerLookupButton.disabled = isLoading;
  if (prevStepButton) prevStepButton.disabled = isLoading;
  if (nextStepButton) nextStepButton.disabled = isLoading;
};

if (scrollTopButton) {
  scrollTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
if (questTranslateButton) {
  questTranslateButton.addEventListener('click', () => {
    toggleQuestTranslation();
  });
}

window.addEventListener('scroll', updateScrollTopButtonVisibility, { passive: true });
window.addEventListener('scroll', updateQuestTranslateButtonVisibility, { passive: true });
window.addEventListener('scroll', updateBackButtonPlacement, { passive: true });
window.addEventListener('resize', updateScrollTopButtonVisibility);
window.addEventListener('resize', updateQuestTranslateButtonVisibility);
window.addEventListener('resize', updateBackButtonPlacement);

bootstrapApp({
  state,
  loadUiPreferences,
  initHideCompletedToggle,
  initSequentialStepToggle,
  initAdvancedSettingsUi,
  setLoading,
  renderTitle,
  updateToggleState,
  prevStepButton,
  nextStepButton,
  toggleButton,
  showSearchControls,
  toggleBar,
  playerBar,
  stepsDiv,
  backButton,
  bindSearchEvents,
  input,
  playerInput,
  playerLookupButton,
  seriesFilter,
  searchToggleButton,
  resultsDiv,
  handleSearchToggle,
  handleSearchInput,
  handleSearchEscape,
  handleOutsideClick,
  handleBack,
  handleSeriesFilterChange,
  handlePlayerSubmit,
  handlePlayerLookup,
  createQuestController,
  bindQuestControls,
  hideCompletedCheckbox,
  resetQuestButton,
  prevStepBtn: prevStepButton,
  nextStepBtn: nextStepButton,
  jumpCurrentButton,
  filterToggle,
  saveUiPreferences,
  showUiToast,
  renderSteps,
  buildStepsRenderParams,
  saveProgress,
  onResetQuest: handleResetQuestAction,
  loadQuestList,
  getQuestList,
  showSearchResultsSkeleton,
  renderSearchResults,
  buildSearchRenderParams,
  resultsRefs,
});

if (settingsButton && settingsPanel) {
  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    lastSettingsTrigger = settingsButton;
    toggleSettingsModal();
  });
}

if (settingsButtonQuest && settingsPanel) {
  settingsButtonQuest.addEventListener('click', (event) => {
    event.stopPropagation();
    lastSettingsTrigger = settingsButtonQuest;
    toggleSettingsModal();
  });
}

if (settingsCloseButton) {
  settingsCloseButton.addEventListener('click', () => {
    closeSettingsModal();
  });
}

if (sequentialStepToggle) {
  sequentialStepToggle.addEventListener('change', () => {
    state.sequentialStepChecking = !!sequentialStepToggle.checked;
    updateSequentialStepToggleUi();
    saveUiPreferences();
    showUiToast(
      state.sequentialStepChecking ? 'Sequential step marking enabled' : 'Free step marking enabled'
    );
    if (state.currentItems.length > 0 && state.showSteps) {
      renderSteps(buildStepsRenderParams(state.currentItems));
    }
  });
}

if (autoTranslateToggle) {
  autoTranslateToggle.addEventListener('change', () => {
    state.autoTranslateSteps = !!autoTranslateToggle.checked;
    if (autoTranslateToggleWrap) {
      autoTranslateToggleWrap.title = state.autoTranslateSteps
        ? 'Automatically translates quest steps when opening Steps view'
        : 'Enable to auto-translate steps when opening Steps view';
    }
    saveUiPreferences();
    showUiToast(state.autoTranslateSteps ? 'Auto-translate enabled' : 'Auto-translate disabled');
    if (state.autoTranslateSteps && state.showSteps && state.currentItems.length > 0) {
      const translationState = ensureQuestTranslationState();
      if (!translationState.isTranslated && !translationState.isLoading) {
        toggleQuestTranslation();
      }
    }
  });
}

if (confirmResetToggle) {
  confirmResetToggle.addEventListener('change', () => {
    state.confirmResetQuestProgress = !!confirmResetToggle.checked;
    if (confirmResetToggleWrap) {
      confirmResetToggleWrap.title = state.confirmResetQuestProgress
        ? 'Ask confirmation before resetting quest progress'
        : 'Reset quest progress immediately';
    }
    saveUiPreferences();
    showUiToast(
      state.confirmResetQuestProgress ? 'Reset confirmation enabled' : 'Reset confirmation disabled'
    );
  });
}

if (stepFontSizeSelect) {
  stepFontSizeSelect.addEventListener('change', () => {
    applyStepFontSize(stepFontSizeSelect.value);
    saveUiPreferences();
    showUiToast(
      state.stepFontSize === 'small'
        ? 'Steps font: small'
        : state.stepFontSize === 'large'
          ? 'Steps font: large'
          : 'Steps font: medium'
    );
  });
}

if (settingsPanel) {
  settingsPanel.addEventListener('click', (event) => {
    if (event.target === settingsPanel) {
      closeSettingsModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!settingsPanel || settingsPanel.classList.contains('hidden')) return;
  event.preventDefault();
  closeSettingsModal();
});

updateScrollTopButtonVisibility();
updateQuestTranslateButtonVisibility();
