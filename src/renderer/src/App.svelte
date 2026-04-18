<script>
  import { onMount } from 'svelte'
  import { project } from './lib/stores/project.svelte.js'
  import { ui } from './lib/stores/ui.svelte.js'
  import { auth } from './lib/stores/auth.svelte.js'

  import TabBar from './components/TabBar.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import EditorArea from './components/EditorArea.svelte'

  import ContextMenu from './components/ContextMenu.svelte'
  import Toast from './components/Toast.svelte'
  import StatusEditor from './components/StatusEditor.svelte'
  import CleanupPreview from './components/CleanupPreview.svelte'
  import HelpPanel from './components/HelpPanel.svelte'
  import ModalDialog from './components/ModalDialog.svelte'

  project.onShowApp(() => {
    ui.appReady = true
  })

  $effect(() => {
    document.documentElement.classList.toggle('dark', ui.darkMode)
  })

  onMount(async () => {
    await auth.init()
    if (!auth.user) return
    try {
      await project.init()
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  })
</script>

<div class="app-root">
  {#if auth.loading}
    <div class="loading">Loading...</div>
  {:else if !auth.user}
    <div class="signin-screen">
      <div class="signin-card">
        <h1>Writer</h1>
        <p>Sign in to continue.</p>
        <button class="signin-btn" onclick={() => auth.signIn()}>
          Sign in with Google
        </button>

        {#if auth.testLoginAvailable && auth.allowedEmails.length}
          <div class="test-signin">
            <div class="test-signin-label">Dev shortcut — sign in as:</div>
            <div class="test-signin-buttons">
              {#each auth.allowedEmails as email}
                <button
                  class="test-signin-btn"
                  onclick={() => auth.signInAs(email)}
                >{email}</button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if !ui.appReady}
    <div class="loading">Loading...</div>
  {:else}
    <TabBar />
    <div class="app-content">
      <Sidebar />
      <EditorArea />
    </div>
  {/if}
</div>

<ContextMenu />
<Toast />
<StatusEditor />
<CleanupPreview />
<HelpPanel />
<ModalDialog />

<style>
  .app-root {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .app-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .loading {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .signin-screen {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
  .signin-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 2rem 2.5rem;
    text-align: center;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
    min-width: 320px;
  }
  .signin-card h1 {
    font-family: var(--font-serif);
    color: var(--accent);
    margin: 0 0 0.5rem;
    font-size: 1.6rem;
  }
  .signin-card p {
    color: var(--muted);
    margin: 0 0 1.2rem;
    font-size: 0.88rem;
  }
  .signin-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.55rem 1.1rem;
    font-size: 0.88rem;
    cursor: pointer;
    transition: filter 0.12s;
  }
  .signin-btn:hover {
    filter: brightness(1.1);
  }
  .test-signin {
    margin-top: 1.4rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--border);
  }
  .test-signin-label {
    font-size: 0.7rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .test-signin-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .test-signin-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0.35rem 0.6rem;
    color: var(--text);
    font-size: 0.78rem;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .test-signin-btn:hover {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
