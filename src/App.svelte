<script>
  import * as R from 'ramda';
  import Train from './Components/Train.svelte';
  import Selection from './Components/Selection.svelte';

  let viewMode = 0;
  let selectedCases;
  const handleView = event => {
    viewMode = R.path(['detail', 'mode'], event);
    selectedCases = R.path(['detail', 'selectedCases'], event);
  };
</script>

{#if viewMode === 0}
  <Selection {selectedCases} on:viewUpdate={handleView} />
{:else if viewMode === 1}
  <Train {selectedCases} on:viewUpdate={handleView} />
{/if}
