<script>
  import * as R from 'ramda';
  import { createEventDispatcher } from 'svelte';

  import Header from './Header.svelte';
  import { algGroup, algInfo } from '../scripts/algsinfo';

  const dispatch = createEventDispatcher();

  export let selectedCases = [];

  const changeMode = event =>
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases,
    });

  const getImage = i => ({
    src: R.join('', ['./img/mega/', R.path([i, 'name'], algInfo), '.png']),
    alt: R.path([i, 'name'], algInfo),
  });

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
  on:viewUpdate={changeMode} />

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
      {#if R.includes(index, selectedCases)}
        <td
          on:click={() => {
            selectedCases = R.without([index], selectedCases);
          }}
          class="selected">
          <img {...getImage(index)} />
          <br />
           {R.path([index, 'name'], algInfo)}
        </td>
      {:else}
        <td
          on:click={() => {
            selectedCases = R.append(index, selectedCases);
          }}
          class="notSelected">
          <img {...getImage(index)} />
          <br />
           {R.path([index, 'name'], algInfo)}
        </td>
      {/if}
    {/each}
  {/each}
</table>
