<script>
  import * as R from 'ramda';
  import Train from './Components/Train.svelte';
  import Selection from './Components/Selection.svelte';

  document.title = 'Megaminx PLL Trainer';

  const saveItems = () => {
    localStorage.settings = JSON.stringify(value);
    localStorage.selectedCases = JSON.stringify(selectedCases);
  };

  const handleView = e => {
    viewMode = R.path(['detail', 'mode'], e);
    selectedCases = R.path(['detail', 'selectedCases'], e);

    if (R.path(['detail', 'unload'])) {
      saveItems();
    }
  };

  const mode = [Selection, Train];

  let selectedCases =
    JSON.parse(localStorage.getItem('selectedCases') || null) || [];
  let viewMode = 0;
  let value = JSON.parse(localStorage.getItem('settings') || null) || [
    50,
    30,
    {
      U: 'Black',
      R: 'Grey',
      F: 'Yellow',
      L: 'Orange',
      Bl: 'LightBlue',
      Br: 'Green',
    },
  ];
</script>

<svelte:window on:unload={saveItems} />

<svelte:component
  this={mode[viewMode]}
  on:viewUpdate={handleView}
  on:win
  {selectedCases}
  bind:value />
