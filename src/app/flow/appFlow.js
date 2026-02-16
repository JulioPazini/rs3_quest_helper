import { loadQuestList } from '../../features/quests/questList.js';
import { renderSearchResults } from '../../features/quests/questRender.js';
import { showSearchControls, showToggleBar, showMessage } from '../../shared/ui/uiControls.js';

export const returnToHome = async (ctx) => {
  const {
    state,
    updateToggleState,
    toggleButton,
    headerEl,
    renderTitle,
    overviewDiv,
    renderOverview,
    clearSearchResults,
    input,
    toggleBar,
    buildSearchRenderParams,
    navBar,
    filterToggle,
    progressIndicator,
    hideCompletedCheckbox,
    prevStepButton,
    nextStepButton,
    backButton,
    stepsDiv,
    viewModeToggle,
    stickyBar,
  } = ctx;

  state.currentItems = [];
  state.currentQuestKey = null;
  state.currentRewardImage = null;
  state.showSteps = false;
  updateToggleState(state.showAllSteps);
  if (toggleButton) toggleButton.classList.add('hidden');
  if (headerEl) headerEl.classList.remove('hidden');
  renderTitle('', null);
  if (renderOverview) renderOverview(null, overviewDiv);
  if (backButton) backButton.classList.add('hidden');
  if (overviewDiv) {
    overviewDiv.innerHTML = '';
    overviewDiv.classList.add('hidden');
  }
  clearSearchResults();
  if (input) input.value = '';
  showSearchControls(toggleBar);
  await loadQuestList();
  state.searchQuery = '';
  renderSearchResults(buildSearchRenderParams(true));
  showToggleBar(toggleBar);
  showMessage(
    stepsDiv,
    'Ready to search. Type a quest name.',
    navBar,
    filterToggle
  );
  if (progressIndicator) progressIndicator.classList.add('hidden');
  if (prevStepButton) prevStepButton.disabled = true;
  if (nextStepButton) nextStepButton.disabled = true;
  if (viewModeToggle) viewModeToggle.classList.add('hidden');
  if (stickyBar) stickyBar.classList.add('hidden');
  if (input) input.focus();
};
