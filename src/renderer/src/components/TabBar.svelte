<script>
  import { onMount } from 'svelte'
  import { ui, toggleDarkMode } from '../lib/stores/ui.svelte.js'

  function setTab(tab) {
    ui.activeTab = tab
    const hash = tab === 'short-stories' ? '#stories' : '#poetry'
    history.replaceState(null, '', hash)
  }

  onMount(() => {
    // sync hash on load
    const hash = ui.activeTab === 'short-stories' ? '#stories' : '#poetry'
    history.replaceState(null, '', hash)

    function onHashChange() {
      ui.activeTab = location.hash === '#stories' ? 'short-stories' : 'poetry'
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  })
</script>

<div class="tab-bar">
  <button
    class="tab-btn"
    class:active={ui.activeTab === 'poetry'}
    onclick={() => setTab('poetry')}
  >Poetry</button>
  <button
    class="tab-btn"
    class:active={ui.activeTab === 'short-stories'}
    onclick={() => setTab('short-stories')}
  >Short stories</button>
  <div class="tab-spacer"></div>
  <button
    class="tab-icon"
    onclick={toggleDarkMode}
    title={ui.darkMode ? 'Light mode' : 'Dark mode'}
  >
    {ui.darkMode ? 'Light' : 'Dark'}
  </button>
  <button
    class="tab-icon"
    onclick={() => (ui.helpOpen = true)}
    title="Help & shortcuts">?</button
  >
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: stretch;
    background: var(--sb-bg);
    border-bottom: 1px solid #000;
    flex-shrink: 0;
    height: 36px;
    padding-left: 1rem;
  }
  .tab-btn {
    background: transparent;
    border: none;
    color: #777;
    padding: 0 1.2rem;
    font-size: 0.78rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.12s;

    font-family: var(--font-ui);
    letter-spacing: 0.02em;
  }
  .tab-btn:hover {
    color: #aaa;
  }
  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .tab-spacer {
    flex: 1;
  }
  .tab-icon {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0 0.6rem;
    transition: color 0.15s;

    display: inline-flex;
    align-items: center;
  }
  .tab-icon:hover {
    color: #aaa;
  }
</style>
