<script>
  export let value;

  const defaultValue = [
    50,
    30,
    {
      U: 'Black',
      R: 'Grey',
      F: 'Yellow',
      L: 'Orange',
      Bl: 'LightBlue',
      Br: 'Green',
    },
  ];
  const names = ['Timer size', 'Scramble size', 'Color Scheme'];

  const reset = (i) => (value[i] = defaultValue[i]);
</script>

<style>
  .one-line {
    display: flex;
    align-items: center;
    justify-content: left;
  }
  .one-line * {
    margin: 10px;
  }
  .multi-line {
    align-items: center;
    justify-content: left;
    display: flex;
    flex-wrap: wrap;
  }
</style>

{#each value as val, i}
  {#if names[i] === 'Color Scheme'}
    {#each [val] as { U, R, F, L, Bl, Br }}
      <div>
        <div class="one-line">
          {names[i]}:

          <!-- TODO: Color scheme can only reset once, find why -->
          <button on:click={() => reset(i)}>Reset</button>
        </div>
        <div class="multi-line">
          <div class="one-line">U: <input bind:value={U} /></div>

          <div class="one-line">F: <input bind:value={F} /></div>
          <div class="one-line">R: <input bind:value={R} /></div>
          <div class="one-line">L: <input bind:value={L} /></div>
          <div class="one-line">Br: <input bind:value={Br} /></div>
          <div class="one-line">Bl: <input bind:value={Bl} /></div>
        </div>
      </div>
    {/each}
  {:else}
    <div class="one-line">
      {names[i]}:
      <input type="number" min="0" bind:value={val} />
      <button on:click={() => reset(i)}>Reset</button>
    </div>
  {/if}
{/each}
