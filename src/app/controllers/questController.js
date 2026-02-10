export const createQuestController = (deps) => {
  const {
    state,
    stepsDiv,
    nextStepButton,
    prevStepButton,
    hideCompletedCheckbox,
    filterToggle,
    updateToggleState,
    saveUiPreferences,
    showUiToast,
    renderSteps,
    buildStepsRenderParams,
    saveProgress,
  } = deps;

  const handleHideCompleted = () => {
    saveUiPreferences();
    showUiToast(
      hideCompletedCheckbox && hideCompletedCheckbox.checked
        ? 'Completed steps hidden'
        : 'Completed steps visible'
    );
    if (state.currentItems.length > 0) {
      renderSteps(buildStepsRenderParams(state.currentItems));
    }
  };

  const handleReset = () => {
    if (!state.currentItems.length) return;
    state.currentItems.forEach((item) => {
      if (item.type === 'step') item.checked = false;
    });
    saveProgress();
    renderSteps(buildStepsRenderParams(state.currentItems));
  };

  const handleToggleAll = () => {
    updateToggleState(!state.showAllSteps);
    saveUiPreferences();
    showUiToast(state.showAllSteps ? 'Showing all steps' : 'Showing current step only');
    if (filterToggle) {
      if (state.showAllSteps) {
        filterToggle.classList.remove('hidden');
      } else {
        filterToggle.classList.add('hidden');
      }
    }
    if (state.currentItems.length > 0) {
      renderSteps(buildStepsRenderParams(state.currentItems));
    }
  };

  const handlePrev = () => {
    const currentIndex = state.currentItems.findIndex(
      (item) => item.type === 'step' && !item.checked
    );
    const prevIndex =
      currentIndex > 0
        ? state.currentItems
            .slice(0, currentIndex)
            .map((item, idx) => (item.type === 'step' ? idx : -1))
            .filter((idx) => idx !== -1)
            .pop()
        : null;

    if (prevIndex !== null && prevIndex !== undefined) {
      state.currentItems[prevIndex].checked = false;
      saveProgress();
      if (state.showAllSteps) state.pendingAutoScroll = true;
      renderSteps(buildStepsRenderParams(state.currentItems));
    }
  };

  const handleNext = () => {
    const currentIndex = state.currentItems.findIndex(
      (item) => item.type === 'step' && !item.checked
    );
    if (currentIndex !== -1) {
      state.currentItems[currentIndex].checked = true;
      saveProgress();
      if (state.showAllSteps) state.pendingAutoScroll = true;
      renderSteps(buildStepsRenderParams(state.currentItems));
    }
  };

  const handleJumpCurrent = () => {
    if (!state.showSteps || !state.showAllSteps) return;
    const currentEl = stepsDiv.querySelector('.step-item.current');
    if (currentEl) {
      currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const handleKeyNav = (e) => {
    if (!state.currentItems.length) return;
    const target = e.target;
    if (
      target &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))
    ) {
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      if (nextStepButton && !nextStepButton.disabled) nextStepButton.click();
    }
    if (e.key === 'p' || e.key === 'P') {
      if (prevStepButton && !prevStepButton.disabled) prevStepButton.click();
    }
  };

  return {
    handleHideCompleted,
    handleReset,
    handleToggleAll,
    handlePrev,
    handleNext,
    handleJumpCurrent,
    handleKeyNav,
  };
};
