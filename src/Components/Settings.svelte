<script>
  export let value;

  const names = ['Timer size', 'Scramble size'];
  console.log(value);
</script>

{#each value as val, i}
  <p>
     {names[i]}:
    <input type="number" min="0" bind:value={val} />
  </p>
{/each}

{#each value as val, i}
  <p> {names[i]}: {val} </p>
{/each}
