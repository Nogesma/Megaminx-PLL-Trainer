<script>
  import * as R from 'ramda';
  import CubePreview from 'cube-preview';
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
    new CubePreview()
      .setType('minx')
      .setColorScheme(cs)
      .svgString(state || R.repeat(0, 27));

  const selectAllNone = () =>
    R.equals(0, R.length(selectedCases))
      ? (selectedCases = R.unnest(
          R.map(
            (i) => R.map((x) => [i, x], R.range(0, R.length(algs[i].cases))),
            R.range(0, R.length(algs))
          )
        ))
      : (selectedCases = []);

  const selectGroup = (i) => {
    const groupCases = R.map(
      (x) => [i, x],
      R.range(0, R.length(algs[i].cases))
    );

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
    max-height: 50%;
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
    background-color: #eeeeee;
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
  <th colspan="4" on:click={selectAllNone}>
    All Cases: 151, Selected:
    {R.length(selectedCases)}
  </th>

  <!--  <tr />-->
  <!--  <th colspan="4" on:click={() => selectGroup(0)}>A</th>-->
  <!--  <th colspan="4" on:click={() => selectGroup(1)}>B</th>-->
  <!--  <tr />-->

  <!--  {#each [0, 1] as i}-->
  <!--    {#each algs[i].cases as { name, state }, j}-->
  <!--      <td-->
  <!--        class={R.includes([i, j], selectedCases) ? 'selected' : 'notSelected'}-->
  <!--        on:click={() => select([i, j])}>-->
  <!--        {@html getImage(colorScheme, state)}-->
  <!--        <br />-->
  <!--        {name}-->
  <!--      </td>-->
  <!--    {/each}-->
  <!--  {/each}-->

  <!--  <tr />-->
  <!--  <th colspan="8" on:click={() => selectGroup(2)}>C</th>-->
  <!--  <tr />-->

  <!--  {#each algs[2].cases as { name, state }, j}-->
  <!--    {#if R.not(j % 8)}-->
  <!--      <tr />-->
  <!--    {/if}-->
  <!--    <td-->
  <!--      class={R.includes([2, j], selectedCases) ? 'selected' : 'notSelected'}-->
  <!--      on:click={() => select([2, j])}>-->
  <!--      {@html getImage(colorScheme, state)}-->
  <!--      <br />-->
  <!--      {name}-->
  <!--    </td>-->
  <!--  {/each}-->

  {#each algs as { cat, cases }, i}
    {#each cases as { name, state }, j}
      {#if j === 0}
        <tr />
        <th colspan="4" on:click={() => selectGroup(i)}>{cat}</th>
        <tr />
      {/if}
      {#if R.not(j % 4)}
        <tr />
      {/if}
      <td
        class={R.includes([i, j], selectedCases) ? 'selected' : 'notSelected'}
        on:click={() => select([i, j])}>
        {@html getImage(colorScheme, state)}
        <br />
        {name}
      </td>
    {/each}
  {/each}
</table>
