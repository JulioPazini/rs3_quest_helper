export const showSearchControls = (toggleBar) => {
  if (toggleBar) toggleBar.classList.remove('search-closed');
};

export const hideSearchControls = (toggleBar, clearSearchResults) => {
  if (toggleBar) toggleBar.classList.add('search-closed');
  if (clearSearchResults) clearSearchResults();
};

export const hideActionBars = (navBar, filterToggle) => {
  if (navBar) navBar.classList.add('hidden');
  if (filterToggle) filterToggle.classList.add('hidden');
};

export const showToggleBar = (toggleBar) => {
  if (toggleBar) toggleBar.classList.remove('hidden');
};

export const showMessage = (stepsDiv, text, navBar, filterToggle) => {
  stepsDiv.textContent = text;
  hideActionBars(navBar, filterToggle);
};

export const showSearchOnlyView = (titleDiv, navBar, stepsDiv, overviewDiv, stepsToggleSection) => {
  if (titleDiv) titleDiv.classList.add('hidden');
  if (navBar) navBar.classList.add('hidden');
  if (stepsDiv) stepsDiv.classList.add('hidden');
  if (overviewDiv) overviewDiv.classList.add('hidden');
  if (stepsToggleSection) stepsToggleSection.classList.add('hidden');
};

export const showQuestView = (titleDiv, navBar, stepsDiv) => {
  if (titleDiv && titleDiv.textContent.trim()) titleDiv.classList.remove('hidden');
  if (navBar) navBar.classList.remove('hidden');
  if (stepsDiv) stepsDiv.classList.remove('hidden');
};

export const bindSearchEvents = (params) => {
  const {
    input,
    playerInput,
    playerLookupButton,
    seriesFilter,
    searchToggleButton,
    backButton,
    toggleBar,
    resultsDiv,
    onToggle,
    onInput,
    onEscape,
    onOutsideClick,
    onBack,
  } = params;

  if (backButton && onBack) {
    backButton.onclick = onBack;
  }

  if (input) {
    input.addEventListener('input', onInput);
  }

  if (searchToggleButton) {
    searchToggleButton.onclick = onToggle;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    onEscape(e);
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!toggleBar || toggleBar.classList.contains('search-closed')) return;
    if (backButton && backButton.classList.contains('hidden')) return;
    if (
      target === input ||
      target === playerInput ||
      (playerInput && playerInput.contains && playerInput.contains(target)) ||
      target === playerLookupButton ||
      (playerLookupButton && playerLookupButton.contains && playerLookupButton.contains(target)) ||
      target === seriesFilter ||
      (seriesFilter && seriesFilter.contains && seriesFilter.contains(target)) ||
      (searchToggleButton && searchToggleButton.contains(target)) ||
      (backButton && backButton.contains(target))
    ) {
      return;
    }
    if (resultsDiv && resultsDiv.contains(target)) return;
    onOutsideClick(e);
  });
};

export const bindQuestControls = (params) => {
  const {
    toggleButton,
    hideCompletedCheckbox,
    resetQuestButton,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    input,
    onToggleAll,
    onHideCompletedChange,
    onReset,
    onPrev,
    onNext,
    onJumpCurrent,
    onKeyNav,
  } = params;

  if (toggleButton) {
    toggleButton.onclick = onToggleAll;
  }

  if (hideCompletedCheckbox) {
    hideCompletedCheckbox.onclick = () => {
      hideCompletedCheckbox.checked = !hideCompletedCheckbox.checked;
      if (onHideCompletedChange) onHideCompletedChange();
    };
  }

  if (resetQuestButton) {
    resetQuestButton.onclick = onReset;
  }

  if (prevStepButton) {
    prevStepButton.onclick = onPrev;
  }

  if (nextStepButton) {
    nextStepButton.onclick = onNext;
  }

  if (jumpCurrentButton) {
    jumpCurrentButton.onclick = onJumpCurrent;
  }

  document.addEventListener('keydown', (e) => {
    if (e.target === input) return;
    onKeyNav(e);
  });
};
