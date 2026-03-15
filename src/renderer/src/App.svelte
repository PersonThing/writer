<script>
  import { onMount } from 'svelte'
  import { project } from './lib/stores/project.svelte.js'
  import { ui } from './lib/stores/ui.svelte.js'

  import TabBar from './components/TabBar.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import EditorArea from './components/EditorArea.svelte'

  import ContextMenu from './components/ContextMenu.svelte'
  import Toast from './components/Toast.svelte'
  import StatusEditor from './components/StatusEditor.svelte'
  import CleanupPreview from './components/CleanupPreview.svelte'
  import SettingsModal from './components/SettingsModal.svelte'
  import HelpPanel from './components/HelpPanel.svelte'
  import ModalDialog from './components/ModalDialog.svelte'

  project.onShowApp(() => {
    ui.appReady = true
  })

  $effect(() => {
    document.documentElement.classList.toggle('dark', ui.darkMode)
  })

  onMount(async () => {
    try {
      await project.openRoot()
    } catch (e) {
      console.error('Failed to load project:', e)
    }
  })
</script>

<div class="app-root">
  {#if !ui.appReady}
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
<SettingsModal />
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
</style>
