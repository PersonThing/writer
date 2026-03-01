<script>
  import { ui } from '../lib/stores/ui.svelte.js';
  import * as api from '../lib/api.js';

  let claudeKey = $state('');
  let claudeStatus = $state('checking');
  let instagramStatus = $state('not_connected');

  // Load state when modal opens
  $effect(() => {
    if (ui.settingsOpen) {
      loadClaudeStatus();
    }
  });

  async function loadClaudeStatus() {
    claudeStatus = 'checking';
    try {
      const key = await api.getClaudeKey();
      claudeStatus = key ? 'configured' : 'not_configured';
    } catch {
      claudeStatus = 'not_configured';
    }
  }

  async function saveClaude() {
    if (!claudeKey.trim()) return;
    await api.setClaudeKey(claudeKey.trim());
    claudeKey = '';
    claudeStatus = 'configured';
  }

  async function clearClaude() {
    await api.setClaudeKey('');
    claudeStatus = 'not_configured';
  }

  async function connectInstagram() {
    try {
      instagramStatus = 'connecting';
      const result = await api.startInstagramAuth();
      instagramStatus = 'connected';
    } catch (e) {
      instagramStatus = 'error';
      alert('Instagram auth failed: ' + e.message);
    }
  }

  function close() {
    ui.settingsOpen = false;
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close();
  }
</script>

{#if ui.settingsOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} role="dialog">
    <div class="modal-box">
      <div class="modal-header">
        <span>Settings</span>
        <button class="modal-close" onclick={close}>&times;</button>
      </div>

      <div class="section">
        <h3 class="section-title">Claude API Key</h3>
        <div class="status-badge" class:ok={claudeStatus === 'configured'}>
          {#if claudeStatus === 'checking'}Checking...
          {:else if claudeStatus === 'configured'}Configured
          {:else}Not set
          {/if}
        </div>

        {#if claudeStatus !== 'configured'}
          <div class="key-form">
            <input
              type="password"
              class="key-input"
              bind:value={claudeKey}
              placeholder="sk-ant-..."
            >
            <button class="btn-primary btn-small" onclick={saveClaude}>Save</button>
          </div>
        {:else}
          <button class="btn-small danger" onclick={clearClaude}>Clear API Key</button>
        {/if}
      </div>

      <hr class="section-sep">

      <div class="section">
        <h3 class="section-title">Instagram</h3>
        <div class="status-badge" class:ok={instagramStatus === 'connected'}>
          {#if instagramStatus === 'connected'}Connected
          {:else if instagramStatus === 'connecting'}Connecting...
          {:else if instagramStatus === 'error'}Error
          {:else}Not connected
          {/if}
        </div>
        <button class="btn-small" onclick={connectInstagram} disabled={instagramStatus === 'connecting'}>
          {instagramStatus === 'connected' ? 'Reconnect' : 'Connect Instagram'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .modal-box {
    background: var(--surface); border-radius: 10px; padding: 1.2rem;
    min-width: 360px; max-width: 440px; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0,0,0,.25);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    font-weight: 600; font-size: .9rem; margin-bottom: .8rem;
    color: var(--text);
  }
  .modal-close {
    background: none; border: none; font-size: 1.2rem; cursor: pointer;
    color: var(--muted); padding: 0 4px;
  }

  .section { margin-bottom: .5rem; }
  .section-title {
    font-size: .82rem; font-weight: 600; color: var(--text);
    margin-bottom: .4rem;
  }
  .section-sep { border: none; border-top: 1px solid var(--border); margin: .8rem 0; }

  .status-badge {
    display: inline-block; font-size: .72rem; padding: .15rem .5rem;
    border-radius: 10px; margin-bottom: .5rem;
    background: #f5e6e6; color: #c0392b;
  }
  .status-badge.ok { background: #e6f5ec; color: #1e8a48; }

  .key-form { display: flex; gap: .5rem; align-items: center; }
  .key-input {
    flex: 1; font-size: .82rem; padding: .35rem .6rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--surface); color: var(--text);
    font-family: var(--font-mono);
  }

  .danger { color: #c0392b; border-color: #c0392b; }
  .danger:hover { background: #fdeaea; }
</style>
