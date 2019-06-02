<script>
  import * as R from 'ramda';
  import Train from './Components/Train.svelte';
  import Selection from './Components/Selection.svelte';

  document.title = 'Megaminx PLL Trainer';
  let selectedCases = [];
  const handleView = event => {
    viewMode = R.path(['detail', 'mode'], event);
    selectedCases = R.path(['detail', 'selectedCases'], event);
  };

  let viewMode = 0;
  const mode = [Selection, Train];

  let value = [
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

<svelte:component
  this={mode[viewMode]}
  on:viewUpdate={handleView}
  {selectedCases}
  bind:value />
