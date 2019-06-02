<script>
  import { drawMegaminxLL } from '../scripts/minx-ll';
  import * as R from 'ramda';
  import { createEventDispatcher } from 'svelte';

  import Header from './Header.svelte';
  import { algGroup, algInfo } from '../scripts/algsinfo';

  const dispatch = createEventDispatcher();

  export let selectedCases;
  export let value;

  $: colorScheme = R.nth(2, value) || {
    U: 'Black',
    R: 'Grey',
    F: 'Yellow',
    L: 'Orange',
    Bl: 'LightBlue',
    Br: 'Green',
  };

  const changeMode = event =>
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases,
    });

  const getImage = (i, cs) =>
    drawMegaminxLL(cs, [
      0,
      0,
      4,
      0,
      5,
      0,
      2,
      0,
      0,
      0,
      0,
      1,
      1,
      0,
      3,
      3,
      0,
      4,
      4,
      0,
      1,
      2,
      2,
      3,
      5,
      5,
    ]);

  const selectAllNone = () =>
    R.equals(0, R.length(selectedCases))
      ? (selectedCases = R.range(0, R.length(algInfo)))
      : (selectedCases = []);

  const selectGroup = i =>
    R.equals(R.difference(selectedCases, algGroup[i].cases), selectedCases)
      ? (selectedCases = R.concat(
          R.path([i, 'cases'], algGroup),
          selectedCases
        ))
      : (selectedCases = R.without(
          R.path([i, 'cases'], algGroup),
          selectedCases
        ));

  const select = i =>
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
  svg {
    display: block;
    max-height: 100%;
    margin: auto;
  }
  th {
    cursor: pointer;
    border: 1px solid black;
    border-radius: 5px;
    border-spacing: 100px;
    text-align: center;
  }
  img {
    width: 70%;
  }
  .selected {
    border: 1px solid black;
  }
  .notSelected {
    border: 1px solid lightgrey;
  }
</style>

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
      {#if R.includes(index, [8, 23, 34, 42, 53])}
        <tr />
      {/if}
      <td
        class={R.includes(index, selectedCases) ? 'selected' : 'notSelected'}
        on:click={() => select(index)}>
        {@html getImage(index, colorScheme)}
        <br />
        {R.path([index, 'name'], algInfo)}
      </td>
    {/each}
  {/each}
</table>
