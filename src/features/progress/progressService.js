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
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return { showAllSteps: true, hideCompleted: false };
    }
    const parsed = JSON.parse(raw);
    return {
      showAllSteps: parsed && typeof parsed.showAllSteps === 'boolean' ? parsed.showAllSteps : true,
      hideCompleted:
        parsed && typeof parsed.hideCompleted === 'boolean' ? parsed.hideCompleted : false,
    };
  } catch (_err) {
    return { showAllSteps: true, hideCompleted: false };
  }
};

export const saveUiPreferences = ({
  storage = localStorage,
  key = 'uiPreferences',
  showAllSteps,
  hideCompleted,
}) => {
  try {
    storage.setItem(
      key,
      JSON.stringify({
        showAllSteps: !!showAllSteps,
        hideCompleted: !!hideCompleted,
      })
    );
  } catch (_err) {
    // ignore storage errors
  }
};
