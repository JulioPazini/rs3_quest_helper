export const getCheckedIndices = (items) => {
  const indices = [];
  (items || []).forEach((item, idx) => {
    if (item.type === 'step' && item.checked) {
      indices.push(idx);
    }
  });
  return indices;
};

export const applyCheckedIndices = (items, indices) => {
  const set = new Set(indices || []);
  (items || []).forEach((item, idx) => {
    if (item.type === 'step') {
      item.checked = set.has(idx);
    }
  });
};

export const saveProgress = ({ storage = localStorage, questKey, items, overviewChecks }) => {
  if (!questKey) return;
  try {
    const stepItems = (items || []).filter((item) => item.type === 'step');
    const checkedSteps = stepItems.filter((item) => item.checked).length;
    const payload = {
      checkedIndices: getCheckedIndices(items || []),
      stepProgress: {
        checkedSteps,
        totalSteps: stepItems.length,
      },
      overviewChecks: overviewChecks || {},
    };
    storage.setItem(questKey, JSON.stringify(payload));
  } catch (_err) {
    // ignore storage errors
  }
};

export const loadProgress = ({ storage = localStorage, questKey }) => {
  if (!questKey) return null;
  try {
    const raw = storage.getItem(questKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
};

export const loadUiPreferences = ({ storage = localStorage, key = 'uiPreferences' }) => {
  const defaults = {
    showAllSteps: true,
    hideCompleted: false,
    sequentialStepChecking: true,
    autoTranslateSteps: false,
    stepFontSize: 'medium',
    confirmResetQuestProgress: true,
  };
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const parsedStepFontSize = String(parsed?.stepFontSize || '')
      .trim()
      .toLowerCase();
    return {
      showAllSteps: parsed && typeof parsed.showAllSteps === 'boolean' ? parsed.showAllSteps : true,
      hideCompleted:
        parsed && typeof parsed.hideCompleted === 'boolean' ? parsed.hideCompleted : false,
      sequentialStepChecking:
        parsed && typeof parsed.sequentialStepChecking === 'boolean'
          ? parsed.sequentialStepChecking
          : true,
      autoTranslateSteps:
        parsed && typeof parsed.autoTranslateSteps === 'boolean'
          ? parsed.autoTranslateSteps
          : false,
      stepFontSize:
        parsedStepFontSize === 'small' || parsedStepFontSize === 'large'
          ? parsedStepFontSize
          : 'medium',
      confirmResetQuestProgress:
        parsed && typeof parsed.confirmResetQuestProgress === 'boolean'
          ? parsed.confirmResetQuestProgress
          : true,
    };
  } catch (_err) {
    return defaults;
  }
};

export const saveUiPreferences = ({
  storage = localStorage,
  key = 'uiPreferences',
  showAllSteps,
  hideCompleted,
  sequentialStepChecking,
  autoTranslateSteps,
  stepFontSize,
  confirmResetQuestProgress,
}) => {
  const normalizedStepFontSize = String(stepFontSize || '')
    .trim()
    .toLowerCase();
  try {
    storage.setItem(
      key,
      JSON.stringify({
        showAllSteps: !!showAllSteps,
        hideCompleted: !!hideCompleted,
        sequentialStepChecking: !!sequentialStepChecking,
        autoTranslateSteps: !!autoTranslateSteps,
        stepFontSize:
          normalizedStepFontSize === 'small' || normalizedStepFontSize === 'large'
            ? normalizedStepFontSize
            : 'medium',
        confirmResetQuestProgress: !!confirmResetQuestProgress,
      })
    );
  } catch (_err) {
    // ignore storage errors
  }
};
