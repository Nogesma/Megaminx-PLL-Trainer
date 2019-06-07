<script>
  export let value;

  const names = ['Timer size', 'Scramble size', 'Color Scheme'];
</script>

{#each value as val, i}
  {#if names[i] === 'Color Scheme'}
    {#each [val] as { U, R, F, L, Bl, Br }}
      U:
      <input bind:value={U} />
      F:
      <input bind:value={F} />
      <br />
      R:
      <input bind:value={R} />
      L:
      <input bind:value={L} />
      <br />
      Br:
      <input bind:value={Br} />
      Bl:
      <input bind:value={Bl} />
    {/each}
  {:else}
    <p>
      {names[i]}:
      <input type="number" min="0" bind:value={val} />
    </p>
  {/if}
{/each}
