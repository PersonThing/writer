<script>
  import { ui, toggleDarkMode } from '../lib/stores/ui.svelte.js';
</script>

<div class="tab-bar">
  <button class="tab-btn active" data-tab="poetry">Poetry</button>
  <div class="tab-spacer"></div>
  <button class="tab-icon" onclick={toggleDarkMode} title={ui.darkMode ? 'Light mode' : 'Dark mode'}>
    {ui.darkMode ? '&#9788;' : '&#9789;'}
  </button>
  <button class="tab-icon" onclick={() => ui.helpOpen = true} title="Help & shortcuts">?</button>
  <button class="tab-icon" onclick={() => ui.settingsOpen = true} title="Settings">&#9881;</button>
</div>

<style>
  .tab-bar {
    display: flex; align-items: stretch;
    background: var(--sb-bg); border-bottom: 1px solid #000;
    flex-shrink: 0; height: 36px;
    -webkit-app-region: drag;
    padding-left: 80px;
  }
  .tab-btn {
    background: transparent; border: none; color: #777;
    padding: 0 1.2rem; font-size: .78rem; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all .12s;
    -webkit-app-region: no-drag;
    font-family: var(--font-ui); letter-spacing: .02em;
  }
  .tab-btn:hover { color: #aaa; }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-spacer { flex: 1; }
  .tab-icon {
    background: none; border: none; color: #666; cursor: pointer;
    font-size: .85rem; padding: 0 .6rem; transition: color .15s;
    -webkit-app-region: no-drag;
  }
  .tab-icon:hover { color: #aaa; }
</style>
