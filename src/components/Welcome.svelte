<script>
  import * as api from '../lib/api.js'
  import { project } from '../lib/stores/project.svelte.js'
  import DirectoryBrowser from './DirectoryBrowser.svelte'

  let browsing = $state(false)

  async function handleSelect(dirPath) {
    browsing = false
    await api.openDirectory(dirPath)
    await project.openRoot(dirPath)
  }
</script>

<div class="welcome">
  <div class="logo">&#9997;&#65039;</div>
  <h1>Writing Projects</h1>
  <p>Your poems, short stories, and ideas — all in one place.</p>
  <button class="btn-primary" onclick={() => (browsing = true)}>Open Poems Folder</button>
  <small>Files are managed on the server</small>
</div>

{#if browsing}
  <DirectoryBrowser
    onSelect={handleSelect}
    onCancel={() => (browsing = false)}
  />
{/if}

<style>
  .welcome {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    gap: 1.2rem;
    text-align: center;
  }
  .logo {
    font-size: 3rem;
    line-height: 1;
  }
  h1 {
    font-family: var(--font-serif);
    font-size: 2rem;
    color: var(--accent);
  }
  p {
    color: var(--muted);
    font-size: 0.95rem;
  }
  small {
    color: #bbb;
    font-size: 0.78rem;
  }
</style>
