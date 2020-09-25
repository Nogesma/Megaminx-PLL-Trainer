<script>
  import CubePreview from 'cube-preview';
  import * as R from 'ramda';
  import { createEventDispatcher } from 'svelte';

  import Header from './Header.svelte';
  import { algGroup, algInfo } from '../scripts/algsinfo';

  const dispatch = createEventDispatcher();

  export let selectedCases;
  export let value;

  $: colorScheme = R.mergeWith(R.or, R.nth(2, value), {
    U: 'Black',
    R: 'Grey',
    F: 'Yellow',
    L: 'Orange',
    Bl: 'LightBlue',
    Br: 'Green',
  });

  const changeMode = (event) =>
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases: selectedCases,
    });

  const getImage = (cs, state) =>
    new CubePreview()
      .setType('minx')
      .setColorScheme(cs)
      .svgString(state || R.repeat(0, 27), 100);

  const selectAllNone = () =>
    R.equals(0, R.length(selectedCases))
      ? (selectedCases = R.range(0, R.length(algInfo)))
      : (selectedCases = []);

  const selectGroup = (i) => {
    const groupCases = R.path([i, 'cases'], algGroup);

    if (R.equals(R.difference(selectedCases, groupCases), selectedCases)) {
      selectedCases = R.concat(groupCases, selectedCases);
    } else {
      selectedCases = R.without(groupCases, selectedCases);
    }
  };

  const select = (i) =>
    R.includes(i, selectedCases)
      ? (selectedCases = R.without([i], selectedCases))
      : (selectedCases = R.append(i, selectedCases));
</script>

<style>
  div {
    width: 100%;
    text-align: center;
  }
  table {
    width: 100%;
    margin-top: 50px;
    -moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  td {
    cursor: pointer;
    border-radius: 5px;
    border-spacing: 100px;
    text-align: center;
  }

  th {
    cursor: pointer;
    border: 1px solid black;
    border-radius: 5px;
    border-spacing: 100px;
    text-align: center;
  }

  .selected {
    border: 1px solid black;
  }
  .notSelected {
    border: 1px solid lightgrey;
  }
</style>

<svelte:window on:unload={() => changeMode({ detail: { mode: 0 } })} />

<Header
  train={R.length(selectedCases)}
  selection={false}
  on:viewUpdate={changeMode}
  bind:value />

<table>
  <th colspan="8" on:click={selectAllNone}>
    All Cases: {R.length(algInfo)}, Selected: {R.length(selectedCases)}
  </th>

  {#each algGroup as { name, cases }, i}
    <tr />
    <th colspan="8" on:click={() => selectGroup(i)}>{name}</th>
    <tr />
    {#each cases as index}
      {#if R.includes(index, [8, 23, 34, 42, 53, 68, 76])}
        <tr />
      {/if}
      <td
        class={R.includes(index, selectedCases) ? 'selected' : 'notSelected'}
        on:click={() => select(index)}>
        {@html getImage(colorScheme, R.path([index, 'state'], algInfo))}
        <br />
        {R.path([index, 'name'], algInfo)}
      </td>
    {/each}
  {/each}
</table>
