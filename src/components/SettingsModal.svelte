<script>
  import { ui } from '../lib/stores/ui.svelte.js'
  import * as api from '../lib/api.js'

  let claudeKey = $state('')
  let claudeStatus = $state('checking')
  let openaiKey = $state('')
  let openaiStatus = $state('checking')
  let claudeModels = $state([])
  let selectedModel = $state('claude-haiku-4-5-20251001')
  let loadingModels = $state(false)

  // Load state when modal opens
  $effect(() => {
    if (ui.settingsOpen) {
      loadClaudeStatus()
      loadOpenAIStatus()
      loadSelectedModel()
    }
  })

  async function loadClaudeStatus() {
    claudeStatus = 'checking'
    try {
      const key = await api.getClaudeKey()
      claudeStatus = key ? 'configured' : 'not_configured'
    } catch {
      claudeStatus = 'not_configured'
    }
  }

  async function saveClaude() {
    if (!claudeKey.trim()) return
    await api.setClaudeKey(claudeKey.trim())
    claudeKey = ''
    claudeStatus = 'configured'
  }

  async function clearClaude() {
    await api.setClaudeKey('')
    claudeStatus = 'not_configured'
    claudeModels = []
  }

  async function loadSelectedModel() {
    const saved = await api.configGet('claudeModel', 'claude-haiku-4-5-20251001')
    selectedModel = saved
  }

  async function loadModels() {
    loadingModels = true
    try {
      claudeModels = await api.aiListModels()
    } catch (e) {
      claudeModels = []
    } finally {
      loadingModels = false
    }
  }

  async function selectModel(modelId) {
    selectedModel = modelId
    await api.configSet('claudeModel', modelId)
  }

  async function loadOpenAIStatus() {
    openaiStatus = 'checking'
    try {
      const key = await api.getOpenAIKey()
      openaiStatus = key ? 'configured' : 'not_configured'
    } catch {
      openaiStatus = 'not_configured'
    }
  }

  async function saveOpenAI() {
    if (!openaiKey.trim()) return
    await api.setOpenAIKey(openaiKey.trim())
    openaiKey = ''
    openaiStatus = 'configured'
  }

  async function clearOpenAI() {
    await api.setOpenAIKey('')
    openaiStatus = 'not_configured'
  }

  function close() {
    ui.settingsOpen = false
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close()
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
            />
            <button class="btn-primary btn-small" onclick={saveClaude}
              >Save</button
            >
          </div>
        {:else}
          <button class="btn-small danger" onclick={clearClaude}
            >Clear API Key</button
          >
        {/if}

        {#if claudeStatus === 'configured'}
          <div class="model-section">
            <label class="model-label">Model</label>
            {#if claudeModels.length > 0}
              <select
                class="model-select"
                value={selectedModel}
                onchange={(e) => selectModel(e.target.value)}
              >
                {#each claudeModels as model}
                  <option value={model.id}>{model.name}</option>
                {/each}
              </select>
            {:else}
              <div class="model-row">
                <span class="model-current">{selectedModel}</span>
                <button
                  class="btn-small"
                  onclick={loadModels}
                  disabled={loadingModels}
                >
                  {loadingModels ? 'Loading...' : 'Load Models'}
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <hr class="section-sep" />

      <div class="section">
        <h3 class="section-title">OpenAI API Key</h3>
        <div class="status-badge" class:ok={openaiStatus === 'configured'}>
          {#if openaiStatus === 'checking'}Checking...
          {:else if openaiStatus === 'configured'}Configured
          {:else}Not set
          {/if}
        </div>

        {#if openaiStatus !== 'configured'}
          <div class="key-form">
            <input
              type="password"
              class="key-input"
              bind:value={openaiKey}
              placeholder="sk-..."
            />
            <button class="btn-primary btn-small" onclick={saveOpenAI}
              >Save</button
            >
          </div>
        {:else}
          <button class="btn-small danger" onclick={clearOpenAI}
            >Clear API Key</button
          >
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .modal-box {
    background: var(--surface);
    border-radius: 10px;
    padding: 1.2rem;
    min-width: 360px;
    max-width: 440px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.8rem;
    color: var(--text);
  }
  .modal-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--muted);
    padding: 0 4px;
  }

  .section {
    margin-bottom: 0.5rem;
  }
  .section-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 0.4rem;
  }
  .section-sep {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.8rem 0;
  }

  .status-badge {
    display: inline-block;
    font-size: 0.72rem;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    margin-bottom: 0.5rem;
    background: #f5e6e6;
    color: #c0392b;
  }
  .status-badge.ok {
    background: #e6f5ec;
    color: #1e8a48;
  }

  .key-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .key-input {
    flex: 1;
    font-size: 0.82rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-family: var(--font-mono);
  }

  .model-section {
    margin-top: 0.6rem;
  }
  .model-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    display: block;
    margin-bottom: 0.3rem;
  }
  .model-select {
    width: 100%;
    font-size: 0.78rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
  }
  .model-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .model-current {
    font-size: 0.75rem;
    color: var(--text);
    font-family: var(--font-mono);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .danger {
    color: #c0392b;
    border-color: #c0392b;
  }
  .danger:hover {
    background: #fdeaea;
  }
</style>
