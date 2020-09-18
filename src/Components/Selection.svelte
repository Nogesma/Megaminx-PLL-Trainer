<script>
  import { drawMegaminxLL } from '../scripts/minx-ll';
  import * as R from 'ramda';
  import { createEventDispatcher } from 'svelte';

  import Header from './Header.svelte';
  import { algs } from '../scripts/algsmap';

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
    drawMegaminxLL(cs, state || R.repeat(0, 27), 100);

  const selectAllNone = () =>
    R.equals(0, R.length(selectedCases))
      ? (selectedCases = R.range(0, R.length(algs)))
      : (selectedCases = []);

  const selectGroup = (i) => {
    const type = R.head(algs[i].name);
    let groupCases = [i];
    while (type === R.head(algs[++i].name)) {
      groupCases.push(i);
    }

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
  .selected {
    border: 1px solid black;
  }
  .notSelected {
    border: 1px solid lightgrey;
  }

  p {
    margin-top: 50px;
  }
</style>

<svelte:window on:unload={() => changeMode({ detail: { mode: 0 } })} />

<Header
  train={R.length(selectedCases)}
  selection={false}
  on:viewUpdate={changeMode}
  bind:value />

<p>
  The site is still in development. Everything should be functional, the UI is
  still being worked on. If you have any questions, notice any breaking bug,
  please contact me on discord: Mano#5911
</p>
<table>
  <th colspan="10" on:click={selectAllNone}>
    All Cases: {R.length(algs)}, Selected: {R.length(selectedCases)}
  </th>

  {#each algs as { name, state }, index}
    {#if index === 0 || R.head(name) !== R.head(R.path([index - 1, 'name'], algs))}
      <tr />
      <th colspan="10" on:click={() => selectGroup(index)}>{R.head(name)}</th>
      <tr />
    {/if}
    <td
      class={R.includes(index, selectedCases) ? 'selected' : 'notSelected'}
      on:click={() => select(index)}>
      {@html getImage(colorScheme, state)}
      <br />
      {name}
    </td>
  {/each}
</table>
