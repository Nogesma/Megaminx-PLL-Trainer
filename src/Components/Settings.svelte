<script>
  export let value;

  const names = ['Timer size', 'Scramble size', 'Color Scheme'];
</script>

{#each value as val, i}
  {#if names[i] === 'Color Scheme'}
    {#each [val] as { U, R, F, L, Bl, Br }}
      <input bind:value={U} />
      <input bind:value={R} />
      <input bind:value={F} />
      <input bind:value={L} />
      <input bind:value={Bl} />
      <input bind:value={Br} />
    {/each}
  {:else}
    <p>
      {names[i]}:
      <input type="number" min="0" bind:value={val} />
    </p>
  {/if}
{/each}

{#each value as val, i}
  <p>{names[i]}: {val}</p>
{/each}
