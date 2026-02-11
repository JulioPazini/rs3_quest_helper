let searchItemCounter = 0;

const createMetaRow = (label, value) => {
  const row = document.createElement('div');
  row.className = 'search-item-meta-row';
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  row.appendChild(strong);
  row.appendChild(document.createTextNode(` ${value || '-'}`));
  return row;
};

export const createSearchItemRow = (item, context) => {
  const { resultsDiv, input, clearSearchResults, loadQuest } = context;
  const row = document.createElement('div');
  row.className = 'search-item';

  const statusValue = String(item.playerStatus || '')
    .trim()
    .toLowerCase();
  const hasStatus = Boolean(statusValue);
  const isCompleted = hasStatus && statusValue === 'completed';
  const isStarted = hasStatus && (statusValue === 'started' || statusValue === 'in progress');
  const isNotStarted = hasStatus && !isCompleted && !isStarted;
  if (hasStatus) {
    if (isCompleted) {
      row.classList.add('search-item-completed');
    } else if (isStarted) {
      row.classList.add('search-item-started');
    } else if (isNotStarted) {
      row.classList.add('search-item-pending');
    }
  }

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'search-item-header';
  header.setAttribute('aria-expanded', 'false');

  const panelId = `search-item-panel-${searchItemCounter++}`;
  header.setAttribute('aria-controls', panelId);

  const titleWrap = document.createElement('span');
  titleWrap.className = 'search-item-title-wrap';
  if (hasStatus) {
    const statusIcon = document.createElement('span');
    let iconType = 'incomplete';
    let iconChar = '\u2716';
    if (isCompleted) {
      iconType = 'complete';
      iconChar = '\u2714';
    } else if (isStarted) {
      iconType = 'started';
      iconChar = '\u25cf';
    }
    statusIcon.className = 'search-item-status-icon ' + iconType;
    statusIcon.textContent = iconChar;
    statusIcon.title = isCompleted
      ? 'Quest completed'
      : isStarted
        ? 'Quest started'
        : `Quest status: ${item.playerStatus}`;
    titleWrap.appendChild(statusIcon);
  }
  const titleText = document.createElement('span');
  titleText.className = 'search-item-title';
  titleText.textContent = item.title;
  titleWrap.appendChild(titleText);
  header.appendChild(titleWrap);

  if (item.membersIcon) {
    const memberIcon = document.createElement('img');
    memberIcon.src = item.membersIcon;
    memberIcon.alt = 'Members';
    memberIcon.className = 'search-item-members-icon';
    header.appendChild(memberIcon);
  }

  const panel = document.createElement('div');
  panel.className = 'search-item-panel';
  panel.id = panelId;

  header.onclick = () => {
    const open = row.classList.contains('open');
    const openRow = resultsDiv.querySelector('.search-item.open');
    if (openRow && openRow !== row) {
      openRow.classList.remove('open');
      const openHeader = openRow.querySelector('.search-item-header');
      if (openHeader) openHeader.setAttribute('aria-expanded', 'false');
    }
    row.classList.toggle('open', !open);
    header.setAttribute('aria-expanded', open ? 'false' : 'true');
  };

  const meta = document.createElement('div');
  meta.className = 'search-item-meta';

  meta.appendChild(createMetaRow('Length', item.length));
  meta.appendChild(createMetaRow('Combat', item.combat));
  meta.appendChild(createMetaRow('Quest points', item.questPoints));
  meta.appendChild(createMetaRow('Series', item.series));
  if (item.playerStatus) {
    meta.appendChild(createMetaRow('Status', item.playerStatus));
  }

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'search-item-action';
  action.innerHTML = 'View quest page <span class="material-symbols-outlined">arrow_forward</span>';
  action.onclick = () => {
    input.value = item.title;
    clearSearchResults();
    loadQuest(item.title);
  };

  panel.appendChild(meta);
  panel.appendChild(action);
  row.appendChild(header);
  row.appendChild(panel);
  return row;
};

const normalizeSeriesLabel = (series) => {
  const value = String(series || '').trim();
  return value || 'No series';
};

const normalizeLengthLabel = (length) => {
  const value = String(length || '').trim();
  return value || 'Unknown length';
};

const normalizeCombatLabel = (combat) => {
  const value = String(combat || '').trim();
  return value || 'No combat info';
};

const normalizeMembershipLabel = (membership, membersIcon = '') => {
  const value = String(membership || '')
    .trim()
    .toLowerCase();
  if (value === 'free') return 'Free';
  if (value === 'members') return 'Members';
  const icon = String(membersIcon || '').toLowerCase();
  if (icon.includes('f2p') || icon.includes('free')) return 'Free';
  if (icon.includes('p2p') || icon.includes('member')) return 'Members';
  return 'Unknown';
};

const normalizeProgressLabel = (status) => {
  const value = String(status || '')
    .trim()
    .toLowerCase();
  if (value === 'completed' || value === 'complete') return 'COMPLETE';
  if (value === 'started' || value === 'in progress' || value === 'in_progress') {
    return 'IN PROGRESS';
  }
  return 'NOT STARTED';
};

const getGroupLabel = (item, mode) => {
  if (mode === 'series') return normalizeSeriesLabel(item.series);
  if (mode === 'length') return normalizeLengthLabel(item.length);
  if (mode === 'combat') return normalizeCombatLabel(item.combat);
  if (mode === 'membership') {
    return normalizeMembershipLabel(item.membership, item.membersIcon);
  }
  if (mode === 'progress') return normalizeProgressLabel(item.playerStatus);
  return '';
};

const normalizeQuestKey = (title) =>
  String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const applyQuestStatusMarkers = (container, playerQuestMeta) => {
  if (!container || !playerQuestMeta) return;
  const items = container.querySelectorAll('li');
  items.forEach((li) => {
    const markerTarget = li.querySelector('a') || li;
    if (!markerTarget) return;
    const questTitle = normalizeQuestKey(markerTarget.textContent);
    if (!questTitle) return;
    const meta = playerQuestMeta[questTitle];
    if (!meta || !meta.status) return;
    const status = String(meta.status).toLowerCase();
    const isCompleted = status === 'completed';
    const isStarted = status === 'started' || status === 'in progress';
    const markerKind = isCompleted ? 'complete' : isStarted ? 'started' : 'incomplete';
    const markerIcon = isCompleted ? '\u2714' : isStarted ? '\u25cf' : '\u2716';
    const marker = document.createElement('span');
    marker.className = 'quest-status-marker ' + markerKind;
    marker.textContent = markerIcon;
    marker.setAttribute(
      'title',
      isCompleted ? 'Quest completed' : isStarted ? 'Quest started' : `Quest status: ${meta.status}`
    );
    markerTarget.insertAdjacentElement('afterend', marker);
  });
};

const SKILL_KEYWORDS = [
  'attack',
  'defence',
  'strength',
  'constitution',
  'ranged',
  'prayer',
  'magic',
  'cooking',
  'woodcutting',
  'fletching',
  'fishing',
  'firemaking',
  'crafting',
  'smithing',
  'mining',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'runecrafting',
  'hunter',
  'construction',
  'summoning',
  'dungeoneering',
  'divination',
  'invention',
  'archaeology',
  'necromancy',
];

const detectSkillRequirement = (text) => {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  let foundSkill = null;
  for (const skill of SKILL_KEYWORDS) {
    const pattern = new RegExp(`\\b${skill}\\b`);
    if (pattern.test(normalized)) {
      foundSkill = skill;
      break;
    }
  }
  if (!foundSkill) return null;
  const levelMatch = normalized.match(/\b(\d{1,3})\b/);
  const requiredLevel = levelMatch ? Number(levelMatch[1]) : null;
  if (!requiredLevel || Number.isNaN(requiredLevel)) return null;
  return { skill: foundSkill, requiredLevel };
};

const applySkillStatusMarkers = (container, playerSkills) => {
  if (!container || !playerSkills || typeof playerSkills !== 'object') return;
  const items = container.querySelectorAll('li');
  items.forEach((li) => {
    const req = detectSkillRequirement(li.textContent);
    if (!req) return;
    const playerLevel = Number(playerSkills[req.skill]);
    if (!Number.isFinite(playerLevel)) return;
    const isComplete = playerLevel >= req.requiredLevel;
    const marker = document.createElement('span');
    marker.className = 'quest-status-marker ' + (isComplete ? 'complete' : 'incomplete');
    marker.textContent = isComplete ? '\u2714' : '\u2716';
    marker.setAttribute(
      'title',
      `${req.skill.charAt(0).toUpperCase()}${req.skill.slice(1)} ${playerLevel}/${req.requiredLevel}`
    );
    li.appendChild(marker);
  });
};

export const renderSearchResults = (params) => {
  const {
    resultsDiv,
    getFilteredResults,
    resultsBatchSize,
    searchState,
    createRowContext,
    groupMode,
    ensureSentinel,
    afterRender,
  } = params;
  if (!resultsDiv) return;
  if (searchState.reset) {
    resultsDiv.innerHTML = '';
    searchState.visibleResults = 0;
    searchState.lastRenderedSeries = null;
  }
  const shouldGroup = groupMode && groupMode !== 'alphabetical';
  const results = getFilteredResults();
  if (results.length === 0) {
    resultsDiv.classList.remove('visible');
    resultsDiv.classList.add('hidden');
    return;
  }
  const appendBatch = (batch) => {
    batch.forEach((item) => {
      const groupLabel = getGroupLabel(item, groupMode);
      if (shouldGroup && searchState.lastRenderedSeries !== groupLabel) {
        const groupTitle = document.createElement('h3');
        groupTitle.className = 'results-group-title';
        groupTitle.textContent = groupLabel;
        resultsDiv.appendChild(groupTitle);
        searchState.lastRenderedSeries = groupLabel;
      }
      if (!shouldGroup) {
        searchState.lastRenderedSeries = null;
      }
      resultsDiv.appendChild(createSearchItemRow(item, createRowContext));
    });
    searchState.visibleResults += batch.length;
  };

  const nextBatch = results.slice(
    searchState.visibleResults,
    searchState.visibleResults + resultsBatchSize
  );
  appendBatch(nextBatch);
  ensureSentinel();
  resultsDiv.classList.add('visible');
  resultsDiv.classList.remove('hidden');

  if (searchState.reset) {
    const root = document.documentElement;
    let safety = 0;
    while (
      searchState.visibleResults < results.length &&
      root.scrollHeight <= root.clientHeight + 40 &&
      safety < 50
    ) {
      safety += 1;
      const more = results.slice(
        searchState.visibleResults,
        searchState.visibleResults + resultsBatchSize
      );
      appendBatch(more);
    }
  }
  if (afterRender) afterRender();
};

export const renderSteps = (params) => {
  const {
    items,
    stepsDiv,
    showAllSteps,
    hideCompletedCheckbox,
    filterToggle,
    navBar,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    currentRewardImage,
    pendingAutoScroll,
    setPendingAutoScroll,
    saveProgress,
    renderStepsFn,
    formatStepHtml,
    updateProgress,
    resetQuestButton,
    currentItems,
    showSearchControls,
  } = params;

  stepsDiv.innerHTML = '';

  if (!items || items.length === 0) {
    stepsDiv.textContent = 'No steps found.';
    if (filterToggle) filterToggle.classList.add('hidden');
    if (navBar) navBar.classList.add('hidden');
    if (jumpCurrentButton) jumpCurrentButton.classList.add('hidden');
    showSearchControls();
    updateProgress();
    return;
  }

  const appendSectionTexts = (sectionTexts) => {
    if (!Array.isArray(sectionTexts) || sectionTexts.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'section-texts';
    sectionTexts.forEach((textHtml) => {
      if (!textHtml) return;
      const block = document.createElement('div');
      block.className = 'section-text-block';
      block.innerHTML = textHtml;
      wrap.appendChild(block);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  };

  const appendSectionImages = (sectionImages) => {
    if (!Array.isArray(sectionImages) || sectionImages.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'section-images';
    sectionImages.forEach((imgData) => {
      if (!imgData || !imgData.src) return;
      const figure = document.createElement('figure');
      figure.className = 'section-image';
      const img = document.createElement('img');
      img.src = imgData.src;
      img.alt = imgData.alt || '';
      img.loading = 'lazy';
      figure.appendChild(img);
      if (imgData.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = imgData.caption;
        figure.appendChild(caption);
      }
      wrap.appendChild(figure);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  };

  const appendSectionInfoBoxes = (sectionInfoBoxes) => {
    if (!Array.isArray(sectionInfoBoxes) || sectionInfoBoxes.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'section-infoboxes';
    sectionInfoBoxes.forEach((boxHtml) => {
      if (!boxHtml) return;
      const block = document.createElement('div');
      block.className = 'section-infobox';
      block.innerHTML = boxHtml;
      wrap.appendChild(block);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  };

  const appendSectionTables = (sectionTables) => {
    if (!Array.isArray(sectionTables) || sectionTables.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'section-tables';
    sectionTables.forEach((tableHtml) => {
      if (!tableHtml) return;
      const block = document.createElement('div');
      block.className = 'section-table-card';
      block.innerHTML = tableHtml;
      wrap.appendChild(block);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  };

  const appendSectionRefLists = (sectionRefLists) => {
    if (!Array.isArray(sectionRefLists) || sectionRefLists.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'section-reflists';
    sectionRefLists.forEach((refHtml) => {
      if (!refHtml) return;
      const block = document.createElement('div');
      block.className = 'section-reflist';
      block.innerHTML = refHtml;
      wrap.appendChild(block);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  };


  const appendInlineNote = (noteItem) => {
    if (!noteItem || !noteItem.html) return;
    if (noteItem.noteType === 'infobox') {
      const wrap = document.createElement('div');
      wrap.className = 'section-infoboxes';
      const block = document.createElement('div');
      block.className = 'section-infobox';
      block.innerHTML = noteItem.html;
      wrap.appendChild(block);
      stepsDiv.appendChild(wrap);
      return;
    }
    if (noteItem.noteType === 'table') {
      const wrap = document.createElement('div');
      wrap.className = 'section-tables';
      const block = document.createElement('div');
      block.className = 'section-table-card';
      block.innerHTML = noteItem.html;
      wrap.appendChild(block);
      stepsDiv.appendChild(wrap);
      return;
    }
    if (noteItem.noteType === 'reflist') {
      const wrap = document.createElement('div');
      wrap.className = 'section-reflists';
      const block = document.createElement('div');
      block.className = 'section-reflist';
      block.innerHTML = noteItem.html;
      wrap.appendChild(block);
      stepsDiv.appendChild(wrap);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'section-texts';
    const block = document.createElement('div');
    block.className = 'section-text-block';
    block.innerHTML = noteItem.html;
    wrap.appendChild(block);
    stepsDiv.appendChild(wrap);
  };

  const sectionHasInlineNoteType = (titleIndex, noteType) => {
    if (titleIndex < 0) return false;
    for (let i = titleIndex + 1; i < items.length && items[i].type !== 'title'; i += 1) {
      const item = items[i];
      if (item.type === 'note' && item.noteType === noteType) return true;
    }
    return false;
  };

  const appendTitleHeading = (titleItem) => {
    const headingLevel = Number(titleItem?.level) || 2;
    const tagName = headingLevel >= 3 ? 'h4' : 'h3';
    const heading = document.createElement(tagName);
    heading.textContent = titleItem?.text || '';
    heading.className = headingLevel >= 3 ? 'step-subsection-title' : 'step-section-title';
    heading.style.marginBottom = '10px';
    stepsDiv.appendChild(heading);
  };

  const totalStepCount = items.filter((item) => item.type === 'step').length;
  if (totalStepCount === 0) {
    if (filterToggle) filterToggle.classList.add('hidden');
    if (jumpCurrentButton) jumpCurrentButton.classList.add('hidden');
    if (navBar) navBar.classList.add('hidden');
    if (prevStepButton) prevStepButton.disabled = true;
    if (nextStepButton) nextStepButton.disabled = true;

    let hasSections = false;
    items.forEach((item, idx) => {
      if (item.type !== 'title') return;
      hasSections = true;
      appendTitleHeading(item);

      if (item.seeAlso && item.seeAlso.length > 0) {
        const small = document.createElement('div');
        small.className = 'seealso';
        small.innerHTML = item.seeAlso.join('<br>');
        stepsDiv.appendChild(small);
      }
      if (!sectionHasInlineNoteType(idx, 'infobox')) {
        appendSectionInfoBoxes(item.sectionInfoBoxes);
      }
      let hasSectionStepsOrNotes = false;
      for (let probe = idx + 1; probe < items.length && items[probe].type !== 'title'; probe += 1) {
        if (items[probe].type === 'step' || items[probe].type === 'note') {
          hasSectionStepsOrNotes = true;
          break;
        }
      }
      if (!hasSectionStepsOrNotes) {
        appendSectionTexts(item.sectionTexts);
      }
      appendSectionTables(item.sectionTables);
      appendSectionRefLists(item.sectionRefLists);
      appendSectionImages(item.sectionImages);
    });

    if (!hasSections) {
      stepsDiv.textContent = 'No steps found.';
    }
    if (currentRewardImage) {
      const img = document.createElement('img');
      img.className = 'reward-image';
      img.src = currentRewardImage;
      img.alt = 'Quest rewards';
      stepsDiv.appendChild(img);
    }
    showSearchControls();
    updateProgress();
    return;
  }

  if (showAllSteps) {
    if (prevStepButton) prevStepButton.disabled = false;
    if (nextStepButton) nextStepButton.disabled = false;
    if (navBar) navBar.classList.remove('hidden');
    if (filterToggle) filterToggle.classList.remove('hidden');
    updateProgress();
    const hideCompletedActive = hideCompletedCheckbox && hideCompletedCheckbox.checked;
    let didRenderRewardImage = false;
    const sectionHasVisibleSteps = (titleIndex) => {
      for (let i = titleIndex + 1; i < items.length; i++) {
        const sectionItem = items[i];
        if (sectionItem.type === 'title') break;
        if (sectionItem.type !== 'step') continue;
        if (hideCompletedActive && sectionItem.checked) continue;
        return true;
      }
      return false;
    };
    const currentIndex = items.findIndex((item) => item.type === 'step' && !item.checked);
    if (jumpCurrentButton) {
      jumpCurrentButton.classList.remove('hidden');
      jumpCurrentButton.disabled = currentIndex === -1;
    }
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      if (item.type !== 'title') continue;

      if (hideCompletedActive && !sectionHasVisibleSteps(idx)) {
        continue;
      }

      appendTitleHeading(item);

      if (item.seeAlso && item.seeAlso.length > 0) {
        const small = document.createElement('div');
        small.className = 'seealso';
        small.innerHTML = item.seeAlso.join('<br>');
        stepsDiv.appendChild(small);
      }

      if (!sectionHasInlineNoteType(idx, 'infobox')) {
        appendSectionInfoBoxes(item.sectionInfoBoxes);
      }
      let hasSectionStepsOrNotes = false;
      for (let probe = idx + 1; probe < items.length && items[probe].type !== 'title'; probe += 1) {
        if (items[probe].type === 'step' || items[probe].type === 'note') {
          hasSectionStepsOrNotes = true;
          break;
        }
      }
      if (!hasSectionStepsOrNotes) {
        appendSectionTexts(item.sectionTexts);
      }

      let sectionCursor = idx + 1;
      let shouldShowSectionReward = false;
      let renderedSectionImages = false;
      while (sectionCursor < items.length && items[sectionCursor].type !== 'title') {
        const sectionItem = items[sectionCursor];
        const stepIndex = sectionCursor;
        if (sectionItem.type === 'note') {
          appendInlineNote(sectionItem);
          sectionCursor += 1;
          continue;
        }
        if (sectionItem.type !== 'step') {
          sectionCursor += 1;
          continue;
        }
        if (hideCompletedCheckbox && hideCompletedCheckbox.checked && sectionItem.checked) {
          sectionCursor += 1;
          continue;
        }

        const stepEl = document.createElement('div');
        const isCurrent = !sectionItem.checked && sectionCursor === currentIndex;
        stepEl.className =
          'step-item' + (sectionItem.checked ? ' completed' : '') + (isCurrent ? ' current' : '');
        const displayHtml = formatStepHtml(sectionItem.html || sectionItem.text, sectionItem.text);
        stepEl.innerHTML = (sectionItem.checked ? '\u2714 ' : '') + (displayHtml || '');

        stepEl.onclick = (event) => {
          if (event && event.target && event.target.closest && event.target.closest('a')) {
            return;
          }
          stepEl.classList.add('clicked');
          setTimeout(() => {
            if (currentIndex !== -1 && stepIndex > currentIndex) {
              for (let i = currentIndex; i <= stepIndex; i += 1) {
                if (items[i].type === 'step') {
                  items[i].checked = true;
                }
              }
            } else if (sectionItem.checked) {
              for (let i = stepIndex; i < items.length; i += 1) {
                if (items[i].type === 'step') {
                  items[i].checked = false;
                }
              }
            } else {
              sectionItem.checked = true;
            }
            saveProgress();
            setPendingAutoScroll(true);
            renderStepsFn(items);
          }, 180);
        };

        const isQuestCompleteStep = /quest complete/i.test(sectionItem.text || '');
        if (isQuestCompleteStep && !renderedSectionImages) {
          appendSectionImages(item.sectionImages);
          renderedSectionImages = true;
        }
        stepsDiv.appendChild(stepEl);

        if (sectionItem.substeps && sectionItem.substeps.length > 0) {
          const list = document.createElement('ul');
          list.className = 'substeps';
          for (const substep of sectionItem.substeps) {
            const li = document.createElement('li');
            li.innerHTML = substep.html || substep.text;
            list.appendChild(li);
          }
          stepsDiv.appendChild(list);
        }

        if (currentRewardImage && /quest complete/i.test(sectionItem.text)) {
          shouldShowSectionReward = true;
        }
        sectionCursor += 1;
      }

      if (!renderedSectionImages) {
        if (!hasSectionStepsOrNotes) {
          appendSectionTables(item.sectionTables);
          appendSectionRefLists(item.sectionRefLists);
        }
        appendSectionImages(item.sectionImages);
      }
      if (shouldShowSectionReward) {
        const img = document.createElement('img');
        img.className = 'reward-image';
        img.src = currentRewardImage;
        img.alt = 'Quest rewards';
        stepsDiv.appendChild(img);
        didRenderRewardImage = true;
      }
      idx = sectionCursor - 1;
    }

    if (currentRewardImage && !didRenderRewardImage) {
      const img = document.createElement('img');
      img.className = 'reward-image';
      img.src = currentRewardImage;
      img.alt = 'Quest rewards';
      stepsDiv.appendChild(img);
    }

    if (pendingAutoScroll()) {
      setPendingAutoScroll(false);
      const currentEl = stepsDiv.querySelector('.step-item.current');
      if (currentEl) {
        currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    return;
  }

  if (filterToggle) filterToggle.classList.add('hidden');
  if (jumpCurrentButton) jumpCurrentButton.classList.add('hidden');

  const currentStepIndex = items.findIndex((item) => item.type === 'step' && !item.checked);

  if (currentStepIndex === -1) {
    stepsDiv.innerHTML = `<h3>Quest complete! \uD83C\uDF89</h3>`;
    if (resetQuestButton) {
      const resetWrap = document.createElement('div');
      resetWrap.className = 'reset-wrap';
      const resetBtn = resetQuestButton.cloneNode(true);
      resetBtn.onclick = () => {
        if (!currentItems.length) return;
        currentItems.forEach((item) => {
          if (item.type === 'step') item.checked = false;
        });
        saveProgress();
        renderStepsFn(currentItems);
      };
      resetWrap.appendChild(resetBtn);
      stepsDiv.appendChild(resetWrap);
    }
    if (prevStepButton) prevStepButton.disabled = false;
    if (nextStepButton) nextStepButton.disabled = true;
    if (navBar) navBar.classList.add('hidden');
    if (jumpCurrentButton) jumpCurrentButton.classList.add('hidden');
    if (currentRewardImage) {
      const img = document.createElement('img');
      img.className = 'reward-image';
      img.src = currentRewardImage;
      img.alt = 'Quest rewards';
      stepsDiv.appendChild(img);
    }
    updateProgress();
    return;
  }

  let currentTitle = null;
  for (let i = currentStepIndex; i >= 0; i--) {
    if (items[i].type === 'title') {
      currentTitle = items[i].text;
      break;
    }
  }

  if (currentTitle) {
    const currentTitleLevel =
      Number(items.find((item) => item.type === 'title' && item.text === currentTitle)?.level) || 2;
    appendTitleHeading({ text: currentTitle, level: currentTitleLevel });
  }

  let currentTitleItem = null;
  if (currentTitle) {
    currentTitleItem = items.find((item) => item.type === 'title' && item.text === currentTitle);
    if (currentTitleItem && currentTitleItem.seeAlso && currentTitleItem.seeAlso.length > 0) {
      const small = document.createElement('div');
      small.className = 'seealso';
      small.innerHTML = currentTitleItem.seeAlso.join('<br>');
      stepsDiv.appendChild(small);
    }
    if (
      currentTitleItem &&
      currentTitleItem.sectionInfoBoxes &&
      currentTitleItem.sectionInfoBoxes.length > 0
    ) {
      const titleIndex = items.findIndex(
        (item) => item.type === 'title' && item.text === currentTitleItem.text
      );
      if (!sectionHasInlineNoteType(titleIndex, 'infobox')) {
        appendSectionInfoBoxes(currentTitleItem.sectionInfoBoxes);
      }
    }
    let hasSectionStepsOrNotes = false;
    const titleIndex = items.findIndex(
      (item) => item.type === 'title' && item.text === currentTitleItem.text
    );
    for (let i = titleIndex + 1; i < items.length && items[i].type !== 'title'; i += 1) {
      if (items[i].type === 'step' || items[i].type === 'note') {
        hasSectionStepsOrNotes = true;
        break;
      }
    }
    if (currentTitleItem && currentTitleItem.sectionTexts && currentTitleItem.sectionTexts.length > 0) {
      if (!hasSectionStepsOrNotes) {
        appendSectionTexts(currentTitleItem.sectionTexts);
      }
    }
    if (
      !hasSectionStepsOrNotes &&
      currentTitleItem &&
      currentTitleItem.sectionTables &&
      currentTitleItem.sectionTables.length > 0
    ) {
      appendSectionTables(currentTitleItem.sectionTables);
    }
    if (
      !hasSectionStepsOrNotes &&
      currentTitleItem &&
      currentTitleItem.sectionRefLists &&
      currentTitleItem.sectionRefLists.length > 0
    ) {
      appendSectionRefLists(currentTitleItem.sectionRefLists);
    }
  }

  const currentTitleIndex = currentTitle
    ? items.findIndex((item) => item.type === 'title' && item.text === currentTitle)
    : -1;
  if (currentTitleIndex >= 0) {
    for (
      let i = currentTitleIndex + 1;
      i < items.length && items[i].type !== 'title';
      i += 1
    ) {
      if (i >= currentStepIndex) break;
      const sectionItem = items[i];
      if (sectionItem.type === 'note') {
        appendInlineNote(sectionItem);
      }
    }
  }

  const step = items[currentStepIndex];
  if (prevStepButton) prevStepButton.disabled = currentStepIndex === 0;
  if (nextStepButton) nextStepButton.disabled = false;
  updateProgress();

  const isCurrentQuestComplete = /quest complete/i.test(step.text || '');
  if (
    isCurrentQuestComplete &&
    currentTitleItem &&
    Array.isArray(currentTitleItem.sectionImages) &&
    currentTitleItem.sectionImages.length > 0
  ) {
    const wrap = document.createElement('div');
    wrap.className = 'section-images';
    currentTitleItem.sectionImages.forEach((imgData) => {
      if (!imgData || !imgData.src) return;
      const figure = document.createElement('figure');
      figure.className = 'section-image';
      const img = document.createElement('img');
      img.src = imgData.src;
      img.alt = imgData.alt || '';
      img.loading = 'lazy';
      figure.appendChild(img);
      if (imgData.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = imgData.caption;
        figure.appendChild(caption);
      }
      wrap.appendChild(figure);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  }

  const stepEl = document.createElement('div');
  stepEl.className = 'step-item current';
  const currentHtml = formatStepHtml(step.html || step.text, step.text);
  stepEl.innerHTML = (step.checked ? '\u2714 ' : '') + (currentHtml || '');

  stepEl.onclick = (event) => {
    if (event && event.target && event.target.closest && event.target.closest('a')) {
      return;
    }
    stepEl.classList.add('clicked');
    setTimeout(() => {
      step.checked = !step.checked;
      saveProgress();
      renderStepsFn(items);
    }, 180);
  };

  stepsDiv.appendChild(stepEl);

  if (step.substeps && step.substeps.length > 0) {
    const list = document.createElement('ul');
    list.className = 'substeps';
    for (const substep of step.substeps) {
      const li = document.createElement('li');
      li.innerHTML = substep.html || substep.text;
      list.appendChild(li);
    }
    stepsDiv.appendChild(list);
  }

  if (
    !isCurrentQuestComplete &&
    currentTitleItem &&
    Array.isArray(currentTitleItem.sectionImages) &&
    currentTitleItem.sectionImages.length > 0
  ) {
    const wrap = document.createElement('div');
    wrap.className = 'section-images';
    currentTitleItem.sectionImages.forEach((imgData) => {
      if (!imgData || !imgData.src) return;
      const figure = document.createElement('figure');
      figure.className = 'section-image';
      const img = document.createElement('img');
      img.src = imgData.src;
      img.alt = imgData.alt || '';
      img.loading = 'lazy';
      figure.appendChild(img);
      if (imgData.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = imgData.caption;
        figure.appendChild(caption);
      }
      wrap.appendChild(figure);
    });
    if (wrap.children.length > 0) {
      stepsDiv.appendChild(wrap);
    }
  }

  if (currentRewardImage && /quest complete/i.test(step.text)) {
    const img = document.createElement('img');
    img.className = 'reward-image';
    img.src = currentRewardImage;
    img.alt = 'Quest rewards';
    stepsDiv.appendChild(img);
  }

  if (navBar) {
    navBar.classList.remove('hidden');
  }
};

export const renderOverview = (overview, overviewEl, options = {}) => {
  if (!overviewEl) return;
  if (!overview) {
    overviewEl.innerHTML = '';
    overviewEl.classList.add('hidden');
    return;
  }
  const { onToggle, savedChecks, playerQuestMeta, playerSkills } = options;

  const sections = [
    { key: 'requirementsQuests', title: 'Quests', iconKey: 'requirementsQuestsIcon' },
    { key: 'requirementsSkills', title: 'Skills' },
    { key: 'requiredItems', title: 'Required Items', listStyle: 'checklist' },
    { key: 'recommendedItems', title: 'Recommended Items', listStyle: 'checklist' },
    { key: 'combat', title: 'Enemies' },
  ];

  overviewEl.innerHTML = '';
  sections.forEach((section) => {
    const html = overview[section.key];
    if (!html) return;
    const h = document.createElement('h4');
    if (section.iconKey && overview[section.iconKey]) {
      const img = document.createElement('img');
      img.src = overview[section.iconKey];
      img.alt = '';
      img.className = 'overview-title-icon';
      h.appendChild(img);
    }
    const titleText = document.createElement('span');
    titleText.textContent = section.title;
    h.appendChild(titleText);
    const block = document.createElement('div');
    block.className = 'overview-section';
    block.innerHTML = html;
    if (section.key === 'requirementsQuests') {
      applyQuestStatusMarkers(block, playerQuestMeta);
    }
    if (section.key === 'requirementsSkills') {
      applySkillStatusMarkers(block, playerSkills);
    }
    if (section.listStyle === 'checklist') {
      const listItems = block.querySelectorAll('li');
      const isRequiredItemsNoneOnly =
        section.key === 'requiredItems' &&
        listItems.length === 1 &&
        listItems[0].textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'none';
      const isRecommendedItemsNoneOnly =
        section.key === 'recommendedItems' &&
        listItems.length === 1 &&
        listItems[0].textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'none';

      if (isRequiredItemsNoneOnly || isRecommendedItemsNoneOnly) {
        block.classList.add('overview-bulleted');
      } else {
        block.classList.add('overview-checklist');
        listItems.forEach((li, idx) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.key = `${section.key}:${idx}`;
          if (savedChecks && savedChecks[checkbox.dataset.key]) {
            checkbox.checked = true;
          }
          checkbox.className = 'overview-check';
          checkbox.addEventListener('change', () => {
            if (onToggle) {
              onToggle(checkbox.dataset.key, checkbox.checked);
            }
          });
          li.insertBefore(checkbox, li.firstChild);
        });
      }
    }
    overviewEl.appendChild(h);
    overviewEl.appendChild(block);
  });

  if (overviewEl.children.length === 0) {
    overviewEl.classList.add('hidden');
  } else {
    overviewEl.classList.remove('hidden');
  }
};
