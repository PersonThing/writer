<script>
  import * as api from '../lib/api.js'

  let { onSelect = () => {}, onCancel = () => {} } = $props()

  let currentPath = $state('')
  let dirs = $state([])
  let loading = $state(true)
  let pathInput = $state('')

  async function browse(dirPath) {
    loading = true
    try {
      const data = await api.browseDirectories(dirPath || undefined)
      currentPath = data.path
      pathInput = data.path
      dirs = data.dirs
    } catch (e) {
      console.error('Browse error:', e)
      dirs = []
    } finally {
      loading = false
    }
  }

  function goUp() {
    const parts = currentPath.replace(/\/$/, '').split('/')
    parts.pop()
    browse(parts.join('/') || '/')
  }

  function enterDir(name) {
    const next = currentPath === '/' ? '/' + name : currentPath + '/' + name
    browse(next)
  }

  function selectCurrent() {
    onSelect(currentPath)
  }

  function goToPath() {
    if (pathInput.trim()) browse(pathInput.trim())
  }

  // Start browsing on mount
  browse('')
</script>

<div class="browser-overlay" onclick={(e) => { if (e.target === e.currentTarget) onCancel() }} role="dialog">
  <div class="browser-box">
    <div class="browser-header">
      <span>Choose Folder</span>
      <button class="browser-close" onclick={onCancel}>&times;</button>
    </div>

    <div class="path-row">
      <input
        class="path-input"
        bind:value={pathInput}
        onkeydown={(e) => { if (e.key === 'Enter') goToPath() }}
      />
      <button class="btn-small" onclick={goToPath}>Go</button>
    </div>

    <div class="dir-list">
      {#if loading}
        <div class="dir-loading">Loading...</div>
      {:else}
        <button class="dir-item dir-up" onclick={goUp}>
          <span class="dir-icon">..</span>
          <span>(up)</span>
        </button>
        {#each dirs as name}
          <button class="dir-item" ondblclick={() => enterDir(name)} onclick={() => enterDir(name)}>
            <span class="dir-icon">📁</span>
            <span>{name}</span>
          </button>
        {/each}
        {#if dirs.length === 0}
          <div class="dir-empty">No subdirectories</div>
        {/if}
      {/if}
    </div>

    <div class="browser-footer">
      <span class="selected-path" title={currentPath}>{currentPath}</span>
      <button class="btn-primary btn-small" onclick={selectCurrent}>Select This Folder</button>
    </div>
  </div>
</div>

<style>
  .browser-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .browser-box {
    background: var(--surface);
    border-radius: 10px;
    padding: 1rem;
    width: 480px;
    max-width: 90vw;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  .browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.6rem;
    color: var(--text);
  }
  .browser-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--muted);
    padding: 0 4px;
  }
  .path-row {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .path-input {
    flex: 1;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 0.78rem;
    font-family: var(--font-mono);
  }
  .dir-list {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    min-height: 200px;
    max-height: 350px;
  }
  .dir-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    width: 100%;
    border: none;
    background: none;
    color: var(--text);
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
  }
  .dir-item:hover {
    background: var(--accent-light);
  }
  .dir-up {
    color: var(--muted);
    font-style: italic;
  }
  .dir-icon {
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }
  .dir-loading, .dir-empty {
    padding: 1rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.82rem;
  }
  .browser-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.6rem;
    justify-content: flex-end;
  }
  .selected-path {
    flex: 1;
    font-size: 0.72rem;
    color: var(--muted);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
