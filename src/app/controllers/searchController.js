export const createSearchController = (deps) => {
  const {
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
    loadQuestFromName,
    returnHome,
  } = deps;

  let searchTimer = null;

  const handleSearchSubmit = () => {
    const questName = input.value.trim();
    if (!questName) {
      showMessage(stepsDiv, 'Type a quest name to search.', navBar, filterToggle);
      return;
    }
    loadQuestFromName(questName);
  };

  const handleSearchInput = () => {
    const query = input.value.trim().toLowerCase();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (getQuestList().length === 0) {
        showSearchResultsSkeleton();
        await loadQuestList();
      }
      state.searchQuery = query;
      if (backButton && !backButton.classList.contains('hidden')) {
        showSearchOnlyView(titleDiv, navBar, stepsDiv, overviewDiv);
      }
      renderSearchResults(buildSearchRenderParams(true));
    }, 200);
  };

  const handleSeriesFilterChange = async () => {
    if (getQuestList().length === 0) {
      showSearchResultsSkeleton();
      await loadQuestList();
    }
    const value = seriesFilter ? seriesFilter.value : 'alphabetical';
    const allowed = new Set([
      'alphabetical',
      'series',
      'length',
      'combat',
      'membership',
      'progress',
    ]);
    state.selectedSeries = allowed.has(value) ? value : 'alphabetical';
    if (backButton && !backButton.classList.contains('hidden')) {
      showSearchOnlyView(titleDiv, navBar, stepsDiv, overviewDiv);
    }
    renderSearchResults(buildSearchRenderParams(true));
  };

  const handleSearchToggle = () => {
    if (toggleBar && toggleBar.classList.contains('search-closed')) {
      showSearchControls(toggleBar);
      input.focus();
      return;
    }
    const questName = input.value.trim();
    if (!questName) {
      showSearchControls(toggleBar);
      input.focus();
      showMessage(stepsDiv, 'Type a quest name to search.', navBar, filterToggle);
      return;
    }
    loadQuestFromName(questName);
  };

  const handleSearchEscape = () => {
    if (document.activeElement !== input) return;
    if (backButton && backButton.classList.contains('hidden')) return;
    hideSearchControls(toggleBar, clearSearchResults);
    resetSearchInput();
    input.blur();
  };

  const handleOutsideClick = () => {
    hideSearchControls(toggleBar, clearSearchResults);
    resetSearchInput();
  };

  const handleBack = () => returnHome();

  return {
    handleSearchSubmit,
    handleSearchInput,
    handleSeriesFilterChange,
    handleSearchToggle,
    handleSearchEscape,
    handleOutsideClick,
    handleBack,
  };
};
