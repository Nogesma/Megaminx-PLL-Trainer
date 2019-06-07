<script>
  import { createEventDispatcher } from 'svelte';
  import * as R from 'ramda';

  import Header from './Header.svelte';
  import Timer from './Timer.svelte';
  import { algGroup, algInfo } from '../scripts/algsinfo';
  import { megaPllMap } from '../scripts/algsmap';
  import { drawMegaminxLL } from '../scripts/minx-ll';

  const dispatch = createEventDispatcher();
  const changeMode = event =>
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases: selectedCases || [],
    });

  export let selectedCases;
  export let value;

  $: scrambleSize = R.nth(1, value) || 30;
  $: colorScheme = R.nth(2, value);

  const getImage = (cs, state) =>
    drawMegaminxLL(cs, state || R.repeat(0, 27), 80);

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
    } else {
      [scramble, caseName] = getScrambleCase();
    }
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
  .mn {
    margin-top: 50px;
  }

  .last-case {
    border: black 1px solid;
  }
</style>

<Header train={false} selection={true} on:viewUpdate={changeMode} bind:value />

<div class="mn">
  <div class="scramble" style="font-size:{scrambleSize}px">{scramble}</div>

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
  <br />
  <br />
  <br />
  {#if R.length(times)}
    <div class="last-case">
      <h4>Last case:</h4>
      <div>{R.path([0, 'caseName'], times)}: {R.path([0, 'time'], times)}</div>
      <div>{R.path([0, 'scramble'], times)}</div>
      <div>
        {@html getImage(colorScheme, R.path([R.path([0, 'caseIndex'], times), 'state'], algInfo))}
      </div>
    </div>
  {/if}
  <br />
  <br />
  <div class="times">
    {#each times as time}
      {R.path(['caseName'], time)}: {R.path(['time'], time)}
      <br />
    {/each}
  </div>
</div>
