<script>
  import { createEventDispatcher } from 'svelte';
  import * as R from 'ramda';

  import Header from './Header.svelte';
  import Timer from './Timer.svelte';
  import { algGroup, algInfo } from '../scripts/algsinfo';
  import { megaPllMap } from '../scripts/algsmap';
  const dispatch = createEventDispatcher();
  const changeMode = event =>
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases,
    });

  export let selectedCases = [];

  let value = [50, 30];

  $: scrambleSize = R.nth(1, value) || 30;

  let currentCase;
  let times = [];
  const auf = ['', 'U', 'U2', "U'", "U2'"];
  const randomItem = array =>
    R.path([Math.floor(Math.random() * array.length)], array);

  const updateTimesArray = time =>
    R.prepend(
      {
        time,
        scramble,
        caseName,
        caseIndex: currentCase,
      },
      times
    );

  const getScrambleCase = () => [
    R.join(' ', [
      randomItem(auf),
      randomItem(
        R.path([(currentCase = randomItem(selectedCases))], megaPllMap)
      ),
      randomItem(auf),
    ]),
    R.path([currentCase, 'name'], algInfo),
  ];

  const removeCase = () => {
    selectedCases = R.without([R.path([0, 'caseIndex'], times)], selectedCases);
    if (R.equals(0, R.length(selectedCases))) {
      changeMode({ detail: { mode: 0 } });
    }
    [scramble, caseName] = getScrambleCase();
  };

  let [scramble, caseName] = getScrambleCase();
</script>

<style>
  .scramble {
    font-size: 40px;
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
  .timer {
    font-size: 50px;
    text-align: center;
  }
</style>

<Header train={false} selection={true} on:viewUpdate={changeMode} bind:value />

<div
  on:click={() => {
    [scramble, caseName] = getScrambleCase();
  }}
  class="scramble"
  style="font-size:{scrambleSize}px">
   {scramble}
</div>
<div>{caseName}</div>

<Timer
  on:newTime={event => {
    times = updateTimesArray(R.path(['detail', 'time'], event));
    [scramble, caseName] = getScrambleCase();
  }}
  bind:value />

<div>Selected Cases : {R.length(selectedCases)}</div>
{#each selectedCases as caseIndex}
  <div>{R.path([caseIndex, 'name'], algInfo)}</div>
{/each}
{#if R.length(times)}
  <div on:click={removeCase}>
    Unselect last case : ({R.path([0, 'caseName'], times)})
  </div>
{/if}
<table>
  {#each times as time}
    <td>{R.path(['time'], time)}</td>
    <td>{R.path(['scramble'], time)}</td>
    <td>{R.path(['caseName'], time)}</td>
    <tr />
  {/each}
</table>
