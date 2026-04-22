<script>
  let { data, focusedCharacter = null, onShowScenes } = $props()

  let selected = $state(focusedCharacter)

  // When the parent tells us to focus a character (e.g. from the
  // Graph tab), reflect that and scroll it into view.
  $effect(() => {
    if (focusedCharacter && focusedCharacter !== selected) {
      selected = focusedCharacter
      queueMicrotask(() => {
        const el = document.getElementById('char-' + focusedCharacter)
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
  })

  let characters = $derived(data?.characters || [])

  function sceneCount(char) {
    return (char.sceneIds || []).length
  }
</script>

<div class="profiles-wrap">
  {#if !characters.length}
    <div class="empty">No characters detected.</div>
  {:else}
    <div class="profiles-grid">
      {#each characters as char}
        <article
          id={'char-' + char.id}
          class="profile-card"
          class:selected={selected === char.id}
          onclick={() => (selected = char.id)}
          onkeydown={(e) => { if (e.key === 'Enter') selected = char.id }}
          role="button"
          tabindex="0"
        >
          <header class="profile-head">
            <h3 class="profile-name">{char.name}</h3>
            {#if (char.aliases || []).length}
              <div class="profile-aliases">
                aka {char.aliases.join(', ')}
              </div>
            {/if}
          </header>

          {#if char.personality}
            <section class="profile-section">
              <div class="profile-label">Personality</div>
              <p>{char.personality}</p>
            </section>
          {/if}

          {#if char.arc}
            <section class="profile-section">
              <div class="profile-label">Arc</div>
              <p>{char.arc}</p>
            </section>
          {/if}

          {#if (char.keyQuotes || []).length}
            <section class="profile-section">
              <div class="profile-label">Key quotes</div>
              <ul class="quotes">
                {#each char.keyQuotes as q}
                  <li>&ldquo;{q}&rdquo;</li>
                {/each}
              </ul>
            </section>
          {/if}

          <footer class="profile-foot">
            <button
              class="scenes-btn"
              onclick={(e) => { e.stopPropagation(); onShowScenes?.(char.id) }}
              disabled={!sceneCount(char)}
            >
              {sceneCount(char)} scene{sceneCount(char) === 1 ? '' : 's'}
            </button>
          </footer>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .profiles-wrap {
    padding: 1rem 1.2rem;
  }
  .profiles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.8rem;
  }
  .profile-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    cursor: pointer;
    transition: border-color 0.12s, box-shadow 0.12s;
    outline: none;
  }
  .profile-card:hover { border-color: var(--accent); }
  .profile-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-light);
  }
  .profile-head { margin-bottom: 0.55rem; }
  .profile-name {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.1rem;
    color: var(--text);
  }
  .profile-aliases {
    font-size: 0.72rem;
    color: var(--muted);
    font-style: italic;
  }
  .profile-section { margin: 0.5rem 0; }
  .profile-label {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-bottom: 2px;
  }
  .profile-section p {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text);
  }
  .quotes { margin: 0; padding-left: 1.1rem; }
  .quotes li {
    font-family: var(--font-serif);
    font-size: 0.85rem;
    color: var(--text);
    margin: 2px 0;
    font-style: italic;
  }
  .profile-foot {
    margin-top: 0.6rem;
    display: flex;
    justify-content: flex-end;
  }
  .scenes-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 3px 9px;
    font-size: 0.72rem;
    color: var(--accent);
    cursor: pointer;
  }
  .scenes-btn:hover:not(:disabled) {
    background: var(--accent-light);
    border-color: var(--accent);
  }
  .scenes-btn:disabled {
    color: var(--muted);
    cursor: default;
  }
  .empty {
    padding: 2.5rem;
    text-align: center;
    color: var(--muted);
    font-style: italic;
  }
</style>
