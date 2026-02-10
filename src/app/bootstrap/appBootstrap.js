export const bootstrapApp = (deps) => {
  const {
    state,
    loadUiPreferences,
    initHideCompletedToggle,
    setLoading,
    renderTitle,
    updateToggleState,
    prevStepButton,
    nextStepButton,
    toggleButton,
    showSearchControls,
    toggleBar,
    stepsDiv,
    backButton,
    bindSearchEvents,
    input,
    playerInput,
    playerLookupButton,
    seriesFilter,
    searchToggleButton,
    resultsDiv,
    handleSearchSubmit,
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
    prevStepBtn,
    nextStepBtn,
    jumpCurrentButton,
    filterToggle,
    saveUiPreferences,
    showUiToast,
    renderSteps,
    buildStepsRenderParams,
    saveProgress,
    loadQuestList,
    getQuestList,
    showSearchResultsSkeleton,
    renderSearchResults,
    buildSearchRenderParams,
    resultsRefs,
  } = deps;

  const setupInitialUI = () => {
    setLoading(false);
    renderTitle('', null);
    updateToggleState(state.showAllSteps);
    if (prevStepButton) prevStepButton.disabled = true;
    if (nextStepButton) nextStepButton.disabled = true;
    toggleButton.classList.add('hidden');
    showSearchControls(toggleBar);
    stepsDiv.textContent = 'Ready to search. Type a quest name and press Enter.';
    if (backButton) backButton.classList.add('hidden');
  };

  const initQuestListDisplay = async () => {
    showSearchResultsSkeleton();
    await loadQuestList();
    if (seriesFilter) {
      seriesFilter.value = state.selectedSeries || 'alphabetical';
    }
    state.searchQuery = '';
    if (getQuestList().length === 0) {
      setTimeout(async () => {
        await loadQuestList();
        if (seriesFilter) {
          seriesFilter.value = state.selectedSeries || 'alphabetical';
        }
        renderSearchResults(buildSearchRenderParams(true));
      }, 300);
      return;
    }
    renderSearchResults(buildSearchRenderParams(true));
  };

  const setupResultsObserver = () => {
    if (!resultsDiv) return;
    if (resultsRefs.observer) return;
    resultsRefs.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!resultsDiv.classList.contains('visible')) return;
          renderSearchResults(buildSearchRenderParams(false));
        });
      },
      { root: null, rootMargin: '100px', threshold: 0.01 }
    );
    if (resultsRefs.sentinel) {
      resultsRefs.observer.observe(resultsRefs.sentinel);
    }
  };

  const handleResultsInfiniteScroll = () => {
    if (!resultsDiv) return;
    if (!resultsDiv.classList.contains('visible')) return;
    const root = document.documentElement || document.body;
    const scrollTop = root.scrollTop || document.body.scrollTop || 0;
    const clientHeight = root.clientHeight || window.innerHeight || 0;
    const scrollHeight = root.scrollHeight || document.body.scrollHeight || 0;
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 40;
    if (!nearBottom) return;
    renderSearchResults(buildSearchRenderParams(false));
  };

  const bindResultsScroll = () => {
    if (!resultsDiv) return;
    resultsDiv.addEventListener('scroll', () => {
      const nearBottom =
        resultsDiv.scrollTop + resultsDiv.clientHeight >= resultsDiv.scrollHeight - 20;
      if (!nearBottom) return;
      renderSearchResults(buildSearchRenderParams(false));
    });
    window.addEventListener('scroll', handleResultsInfiniteScroll);
  };

  const uiPrefs = loadUiPreferences();
  state.showAllSteps = uiPrefs.showAllSteps;
  initHideCompletedToggle(uiPrefs.hideCompleted);
  setupInitialUI();

  bindSearchEvents({
    input,
    playerInput,
    playerLookupButton,
    seriesFilter,
    searchToggleButton,
    backButton,
    toggleBar,
    resultsDiv,
    onSubmit: handleSearchSubmit,
    onToggle: handleSearchToggle,
    onInput: handleSearchInput,
    onEscape: handleSearchEscape,
    onOutsideClick: handleOutsideClick,
    onBack: handleBack,
  });

  if (seriesFilter) {
    seriesFilter.addEventListener('change', handleSeriesFilterChange);
  }
  if (playerInput) {
    playerInput.addEventListener('keydown', handlePlayerSubmit);
  }
  if (playerLookupButton) {
    playerLookupButton.addEventListener('click', handlePlayerLookup);
  }

  const {
    handleHideCompleted,
    handleReset,
    handleToggleAll,
    handlePrev,
    handleNext,
    handleJumpCurrent,
    handleKeyNav,
  } = createQuestController({
    state,
    stepsDiv,
    nextStepButton: nextStepBtn,
    prevStepButton: prevStepBtn,
    hideCompletedCheckbox,
    filterToggle,
    updateToggleState,
    saveUiPreferences,
    showUiToast,
    renderSteps,
    buildStepsRenderParams,
    saveProgress,
  });

  bindQuestControls({
    toggleButton,
    hideCompletedCheckbox,
    resetQuestButton,
    prevStepButton: prevStepBtn,
    nextStepButton: nextStepBtn,
    jumpCurrentButton,
    input,
    onToggleAll: handleToggleAll,
    onHideCompletedChange: handleHideCompleted,
    onReset: handleReset,
    onPrev: handlePrev,
    onNext: handleNext,
    onJumpCurrent: handleJumpCurrent,
    onKeyNav: handleKeyNav,
  });

  initQuestListDisplay();
  setupResultsObserver();
  bindResultsScroll();
};
