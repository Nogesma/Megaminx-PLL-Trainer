<script>
  import { createEventDispatcher } from 'svelte';
  import * as R from 'ramda';
  import CubePreview from 'cube-preview';

  import Header from './Header.svelte';
  import Timer from './Timer.svelte';
  import { algs } from '../scripts/algsmap';

  const dispatch = createEventDispatcher();
  const changeMode = (event) => {
    localStorage.times = JSON.stringify(times);
    dispatch('viewUpdate', {
      mode: R.path(['detail', 'mode'], event),
      selectedCases: selectedCases,
    });
  };

  export let selectedCases;
  export let value;

  $: scrambleSize = R.nth(1, value) || 30;
  $: colorScheme = R.mergeWith(R.or, R.nth(2, value), {
    U: 'Black',
    R: 'Grey',
    F: 'Yellow',
    L: 'Orange',
    Bl: 'LightBlue',
    Br: 'Green',
  });

  const getImage = (cs, state) =>
    new CubePreview()
      .setType('minx')
      .setColorScheme(cs)
      .svgString(state ?? R.repeat(0, 27));

  let currentCase;
  let times = JSON.parse(localStorage.getItem('times') || null) || [];
  const auf = ['', 'U', 'U2', "U'", "U2'"];

  const randomItem = (array) =>
    R.path([Math.floor(Math.random() * array.length)], array);

  const updateTimesArray = (time) =>
    R.prepend(
      {
        time,
        scramble,
        caseName: R.path(
          [currentCase[0], 'cases', currentCase[1], 'name'],
          algs
        ),
        caseIndex: currentCase,
      },
      times
    );

  const getScramble = () => {
    currentCase = randomItem(selectedCases);
    return R.join(' ', [
      randomItem(auf),
      randomItem(
        R.path([currentCase[0], 'cases', currentCase[1], 'scr'], algs)
      ),
      randomItem(auf),
    ]);
  };
  const removeCase = () => {
    selectedCases = R.without([R.path([0, 'caseIndex'], times)], selectedCases);
    if (R.equals(0, R.length(selectedCases))) {
      changeMode({ detail: { mode: 0 } });
    } else {
      scramble = getScramble();
    }
  };

  let scramble = getScramble();
</script>

<style>
  html,
  body {
    margin: 0;
    height: 100%;
    overflow-x: hidden;
    overflow-y: hidden;
  }

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
    text-align: center;
  }
  .mn {
    margin-top: 50px;
  }

  .last-case {
    border: black 1px solid;
  }

  svg {
    width: auto;
    height: 10%;
  }

  .times {
    border: 1px solid black;
    border-radius: 5px;
    border-spacing: 100px;
    height: 200px;
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>

<svelte:window on:unload={() => changeMode({ detail: { mode: 0 } }, true)} />

<Header train={false} selection={true} on:viewUpdate={changeMode} bind:value />

<div class="mn">
  <div class="scramble" style="font-size:{scrambleSize}px">{scramble}</div>

  <Timer
    on:newTime={(event) => {
      times = updateTimesArray(R.path(['detail', 'time'], event));
      scramble = getScramble();
    }}
    bind:value />

  <div>Selected Cases : {R.length(selectedCases)}</div>
  {#each selectedCases as [i, j]}
    <div>{R.path([i, 'cases', j, 'name'], algs)}</div>
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
      <!--      <div>-->
      <!--        {@html getImage(colorScheme, R.path([R.path([0, 'caseIndex'], times)[0], 'cases', R.path([0, 'caseIndex'], times)[1], 'state'], algs))}-->
      <!--      </div>-->
    </div>
  {/if}
  <br />
  <br />
  <div class="times">
    {#each times as time}
      {R.path(['caseName'], time)}:
      {R.path(['time'], time)}
      <br />
    {/each}
  </div>
</div>
