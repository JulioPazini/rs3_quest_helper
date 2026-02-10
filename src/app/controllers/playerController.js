export const createPlayerController = (deps) => {
  const { getQuestList, loadQuestList, loadPlayerQuests, playerInput, setPlayerLookupLoading } =
    deps;

  let playerLookupPending = false;

  const runLookup = async () => {
    if (playerLookupPending) return;
    playerLookupPending = true;
    setPlayerLookupLoading(true);
    try {
      if (getQuestList().length === 0) {
        await loadQuestList();
      }
      await loadPlayerQuests(playerInput ? playerInput.value : '');
    } finally {
      setPlayerLookupLoading(false);
      playerLookupPending = false;
    }
  };

  const handlePlayerSubmit = async (e) => {
    if (!e || e.key !== 'Enter') return;
    e.preventDefault();
    await runLookup();
  };

  const handlePlayerLookup = async () => {
    await runLookup();
  };

  return {
    handlePlayerSubmit,
    handlePlayerLookup,
  };
};
