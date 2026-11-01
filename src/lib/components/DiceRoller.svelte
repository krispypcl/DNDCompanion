<script lang="ts">
  /**
   * A dice tray for the owner's own rolls. Tap dice into the pool, set a
   * modifier, choose advantage or disadvantage, roll. Nothing is saved or
   * shown to anyone else: it is a tray, not a record.
   */
  import { DIE_SIDES, addDie, diceCount, formula, hasD20, roll, type Mode, type Pool, type Roll, type Sides } from '$lib/rules/dice';
  import { prefersReducedMotion } from '$lib/motion';

  let pool = $state<Pool>({ dice: {}, modifier: 0, mode: 'normal' });
  let last = $state<Roll | null>(null);
  let history = $state<Roll[]>([]);
  /** Faces flicker for a moment before they land. */
  let tumbling = $state(false);
  let spin = $state(0);
  let seq = $state(0);
  let spinner: ReturnType<typeof setInterval> | undefined;

  const empty = $derived(diceCount(pool) === 0 && pool.modifier === 0);
  const MODES: { mode: Mode; label: string }[] = [
    { mode: 'disadvantage', label: 'Disadv.' },
    { mode: 'normal', label: 'Normal' },
    { mode: 'advantage', label: 'Adv.' }
  ];

  function go() {
    if (diceCount(pool) === 0) return;
    const result = roll($state.snapshot(pool) as Pool);
    if (last) history = [last, ...history].slice(0, 6);
    last = result;
    seq += 1;
    if (!prefersReducedMotion()) {
      tumbling = true;
      clearInterval(spinner);
      spinner = setInterval(() => (spin += 1), 55);
      setTimeout(() => {
        clearInterval(spinner);
        tumbling = false;
      }, 440);
    }
  }

  function clear() {
    pool = { dice: {}, modifier: 0, mode: pool.mode };
  }

  const isCrit = (r: Roll) => r.dice.some((d) => d.sides === 20 && d.value === 20);
  const isFumble = (r: Roll) => r.dice.some((d) => d.sides === 20 && d.value === 1);
  /** A passing face while the dice tumble. `tick` only makes it change each frame. */
  const flicker = (sides: number, tick: number) => 1 + ((Math.floor(Math.random() * sides) + tick) % sides);
</script>

<section class="tray" aria-label="Dice roller">
  <h3 class="cap">Dice</h3>

  <div class="dice" role="group" aria-label="Add dice">
    {#each DIE_SIDES as sides (sides)}
      {@const n = pool.dice[sides] ?? 0}
      <div class="die" class:in={n > 0}>
        <button class="add" onclick={() => (pool = addDie(pool, sides as Sides))} aria-label="Add a d{sides}">
          d{sides}
          {#if n > 0}<span class="n">{n}</span>{/if}
        </button>
        {#if n > 0}
          <button class="less" onclick={() => (pool = addDie(pool, sides as Sides, -1))} aria-label="Remove a d{sides}">−</button>
        {/if}
      </div>
    {/each}
  </div>

  <div class="controls">
    <div class="mod" role="group" aria-label="Modifier">
      <button onclick={() => (pool = { ...pool, modifier: pool.modifier - 1 })} aria-label="Lower the modifier">−</button>
      <input type="number" aria-label="Modifier" value={pool.modifier}
             onchange={(e) => (pool = { ...pool, modifier: Math.max(-99, Math.min(99, Math.round(Number(e.currentTarget.value) || 0))) })} />
      <button onclick={() => (pool = { ...pool, modifier: pool.modifier + 1 })} aria-label="Raise the modifier">+</button>
    </div>
    <div class="modes" role="radiogroup" aria-label="Advantage">
      {#each MODES as m (m.mode)}
        <button role="radio" aria-checked={pool.mode === m.mode} class:on={pool.mode === m.mode}
                title={m.mode === 'normal' ? 'Roll each d20 once' : `Roll each d20 twice and keep the ${m.mode === 'advantage' ? 'higher' : 'lower'}`}
                onclick={() => (pool = { ...pool, mode: m.mode })}>{m.label}</button>
      {/each}
    </div>
  </div>

  <div class="go">
    <span class="formula" aria-live="polite">
      {formula(pool) || 'Tap dice to add them'}
      {#if pool.mode !== 'normal' && !hasD20(pool) && diceCount(pool) > 0}<small>(no d20 to apply it to)</small>{/if}
    </span>
    {#if !empty}<button class="clear" onclick={clear}>Clear</button>{/if}
    <button class="roll" disabled={diceCount(pool) === 0} onclick={go}>Roll</button>
  </div>

  {#if last}
    {#key seq}
      <div class="result" class:crit={isCrit(last)} class:fumble={isFumble(last)} role="status">
        <strong class="total" class:settled={!tumbling}>{tumbling ? '…' : last.total}</strong>
        <div class="faces">
          {#each last.dice as d, i (i)}
            <span class="face d{d.sides}" class:max={d.value === d.sides} class:min={d.value === 1}
                  style:--i={i}>
              <i>{tumbling ? flicker(d.sides, spin) : d.value}</i>
              {#if d.dropped !== undefined}<s title="Dropped">{d.dropped}</s>{/if}
              <small>d{d.sides}</small>
            </span>
          {/each}
          {#if last.pool.modifier}
            <span class="modval">{last.pool.modifier > 0 ? '+' : '−'}{Math.abs(last.pool.modifier)}</span>
          {/if}
        </div>
        <p class="said">{last.formula}{isCrit(last) ? ' · natural 20' : isFumble(last) ? ' · natural 1' : ''}</p>
      </div>
    {/key}
  {/if}

  {#if history.length}
    <ol class="history" aria-label="Earlier rolls">
      {#each history as h (h)}
        <li><b>{h.total}</b> <span>{h.formula}</span></li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .tray { padding-top: 1.25rem; }
  .cap {
    margin: 0 0 0.625rem; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  button { font: inherit; cursor: pointer; }
  .dice { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .die { position: relative; display: inline-flex; }
  .add {
    position: relative; min-width: 3rem; padding: 0.4375rem 0.625rem;
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); font-size: 0.8125rem; font-weight: 600;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .add:hover { border-color: var(--a-edge); color: var(--a); }
  .add:active { transform: translateY(1px) scale(0.97); }
  .die.in .add { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .n {
    position: absolute; top: -0.5rem; right: -0.375rem; min-width: 1.125rem; height: 1.125rem;
    padding: 0 0.25rem; border-radius: 999px; background: var(--a); color: var(--bg);
    font-size: 0.6875rem; line-height: 1.125rem; text-align: center;
    animation: bump 0.25s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  @keyframes bump { from { transform: scale(0.5); } }
  /* On the die's corner, opposite the count, so adding the first one does
     not push the dice after it along. */
  .less {
    position: absolute; bottom: -0.5rem; right: -0.375rem; width: 1.125rem; height: 1.125rem;
    display: grid; place-items: center; padding: 0; line-height: 1; font-size: 0.8125rem;
    background: var(--surface); border: 1px solid var(--line); color: var(--dim); border-radius: 50%;
    animation: bump 0.25s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .less:hover { color: var(--danger); border-color: var(--danger); }
  .dice { row-gap: 0.75rem; }

  .controls { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; align-items: center; }
  .mod { display: inline-flex; align-items: stretch; }
  .mod button {
    width: 2rem; background: var(--raised); border: 1px solid var(--line); color: var(--text);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .mod button:first-child { border-radius: var(--r-sm) 0 0 var(--r-sm); }
  .mod button:last-child { border-radius: 0 var(--r-sm) var(--r-sm) 0; }
  .mod button:hover { color: var(--a); border-color: var(--a-edge); }
  .mod input {
    width: 3rem; text-align: center; background: var(--bg); color: var(--text);
    border: 1px solid var(--line); border-left: 0; border-right: 0; font: inherit; font-weight: 600;
    -moz-appearance: textfield; appearance: textfield;
  }
  .mod input::-webkit-outer-spin-button, .mod input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .modes { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; }
  .modes button {
    background: none; border: 0; color: var(--dim); padding: 0.375rem 0.75rem; font-size: 0.8125rem;
    transition: background-color 0.18s ease, color 0.18s ease;
  }
  .modes button + button { border-left: 1px solid var(--line); }
  .modes button:hover { color: var(--text); }
  .modes button.on { background: var(--a-wash); color: var(--a); }

  .go { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
  .formula { flex: 1 1 10rem; font-size: 0.875rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  .formula small { margin-left: 0.25rem; color: var(--faint); }
  .clear {
    background: none; border: 1px solid var(--line-soft); color: var(--dim);
    border-radius: var(--r-sm); padding: 0.4375rem 0.75rem; font-size: 0.8125rem;
  }
  .clear:hover { color: var(--text); border-color: var(--line); }
  .roll {
    background: var(--a); border: 1px solid var(--a); color: var(--bg); font-weight: 650;
    border-radius: var(--r-sm); padding: 0.4375rem 1.25rem; font-size: 0.875rem;
    transition: filter 0.15s ease, transform 0.08s ease, opacity 0.15s ease;
  }
  .roll:hover:not(:disabled) { filter: brightness(1.1); }
  .roll:active:not(:disabled) { transform: translateY(1px); }
  .roll:disabled { opacity: 0.4; cursor: default; }

  .result {
    margin-top: 0.875rem; padding: 0.75rem 0.875rem; border-radius: var(--r);
    border: 1px solid var(--line-soft); background: var(--raised);
    display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; align-items: center;
    animation: land 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  @keyframes land { from { opacity: 0; transform: translateY(4px); } }
  .result.crit { border-color: var(--a-edge); box-shadow: 0 0 0 1px var(--a-edge), 0 0 22px -6px var(--a); }
  .result.fumble { border-color: color-mix(in oklch, var(--danger) 60%, transparent); }
  .total { grid-row: span 2; font-size: 2.25rem; line-height: 1; font-weight: 650; color: var(--a-hi); font-variant-numeric: tabular-nums; }
  .total.settled { animation: pop 0.3s cubic-bezier(0.3, 1.5, 0.5, 1); }
  @keyframes pop { from { transform: scale(0.6); opacity: 0.3; } }
  .faces { display: flex; flex-wrap: wrap; gap: 0.3125rem; align-items: flex-end; }
  .face {
    display: inline-flex; flex-direction: column; align-items: center; min-width: 2rem;
    padding: 0.1875rem 0.375rem; border-radius: var(--r-sm); border: 1px solid var(--line);
    background: var(--surface); font-variant-numeric: tabular-nums;
    animation: drop 0.36s cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
    animation-delay: calc(var(--i) * 35ms);
  }
  @keyframes drop { from { transform: translateY(-8px) rotate(-12deg); opacity: 0; } }
  .face i { font-style: normal; font-weight: 650; font-size: 0.9375rem; }
  .face s { font-size: 0.6875rem; color: var(--faint); }
  .face small { font-size: 0.5625rem; color: var(--faint); letter-spacing: 0.04em; }
  .face.d20.max { border-color: var(--a); color: var(--a); }
  .face.d20.min { border-color: var(--danger); color: var(--danger); }
  .modval { font-weight: 600; color: var(--dim); padding: 0 0.25rem 0.375rem; }
  .said { margin: 0; font-size: 0.75rem; color: var(--dim); }

  .history { list-style: none; margin: 0.625rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
  .history li { font-size: 0.78rem; color: var(--faint); display: flex; gap: 0.5rem; animation: land 0.25s ease; }
  .history b { color: var(--dim); min-width: 1.75rem; text-align: right; font-variant-numeric: tabular-nums; }

  @media (max-width: 700px) {
    .add { min-width: 3.25rem; padding: 0.5625rem 0.625rem; }
    .less { width: 1.5rem; height: 1.5rem; bottom: -0.625rem; right: -0.5rem; }
    .mod button { width: 2.5rem; }
    .mod input { font-size: 16px; }
    .modes button { padding: 0.5rem 0.75rem; }
  }
</style>
