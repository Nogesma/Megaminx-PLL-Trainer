<script>
  import { createEventDispatcher, getContext } from 'svelte';
  import { fly } from 'svelte/transition';
  import Settings from './Settings.svelte';

  export let train;
  export let selection;
  export let value;

  let background;
  let wrap;

  let settingsOpen = false;

  const dispatch = createEventDispatcher();

  const changeMode = (mode) => dispatch('viewUpdate', { mode });

  const handleKeyup = ({ key }) => {
    if (settingsOpen && key === 'Escape') {
      settingsOpen = false;
    }
  };
</script>

<style>
  * {
    box-sizing: border-box;
  }

  .bg {
    top: 0;
    left: 0;
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.66);
  }

  .window-wrap {
    position: relative;
    margin: 2rem;
    max-height: 100%;
  }

  .window {
    position: relative;
    width: 40rem;
    max-width: 100%;
    max-height: 100%;
    margin: 2rem auto;
    color: black;
    border-radius: 0.5rem;
    background: white;
  }

  .content {
    position: relative;
    padding: 1rem;
    max-height: calc(100vh - 4rem);
    overflow: auto;
  }

  .close {
    display: block;
    box-sizing: border-box;
    position: absolute;
    z-index: 1000;
    top: 1rem;
    right: 1rem;
    margin: 0;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: 0;
    color: black;
    border-radius: 1.5rem;
    background: white;
    box-shadow: 0 0 0 1px black;
    transition: transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
      background 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
    -webkit-appearance: none;
  }

  .close:before,
  .close:after {
    content: '';
    display: block;
    box-sizing: border-box;
    position: absolute;
    top: 50%;
    width: 1rem;
    height: 1px;
    background: black;
    transform-origin: center;
    transition: height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
      background 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .close:before {
    -webkit-transform: translate(0, -50%) rotate(45deg);
    -moz-transform: translate(0, -50%) rotate(45deg);
    transform: translate(0, -50%) rotate(45deg);
    left: 0.25rem;
  }

  .close:after {
    -webkit-transform: translate(0, -50%) rotate(-45deg);
    -moz-transform: translate(0, -50%) rotate(-45deg);
    transform: translate(0, -50%) rotate(-45deg);
    left: 0.25rem;
  }

  .close:hover {
    background: black;
  }

  .close:hover:before,
  .close:hover:after {
    height: 2px;
    background: white;
  }

  .close:focus {
    border-color: #3399ff;
    box-shadow: 0 0 0 2px #3399ff;
  }

  .close:active {
    transform: scale(0.9);
  }

  .close:hover,
  .close:focus,
  .close:active {
    outline: none;
  }

  .main {
    background-color: white;
    position: fixed;
    top: 0;
    width: 100%;
    padding: 10px;
    font-size: 200%;
    font-weight: bold;
    user-select: none;
    -webkit-user-select: none;
    overflow: auto;
    height: 50px;
  }

  .title {
    float: left;
  }

  .mode {
    float: right;
    padding-right: 10px;
  }
</style>

<svelte:window on:keyup={handleKeyup} />

<div class="main">
  <div class="title">Megaminx PLL Trainer</div>
  {#if train}
    <div class="mode" on:click={() => changeMode(1)}>Train</div>
  {/if}
  {#if selection}
    <div class="mode" on:click={() => changeMode(0)}>Selection</div>
  {/if}
  <div class="mode" on:click={() => (settingsOpen = true)}>Settings</div>
</div>
<div>
  {#if settingsOpen}
    <div
      class="bg"
      bind:this={background}
      on:click={(event) => (event.target === background || event.target === wrap ? (settingsOpen = false) : '')}>
      <div class="window-wrap" bind:this={wrap}>
        <div class="window">
          {#if false}
            <button on:click={() => (settingsOpen = false)} class="close" />
          {/if}
          <div class="content">
            <Settings bind:value />
          </div>
        </div>
      </div>
    </div>
  {/if}
  <slot />
</div>
