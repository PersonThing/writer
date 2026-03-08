<script>
  import { onMount } from 'svelte'
  import * as api from './lib/api.js'
  import { project } from './lib/stores/project.svelte.js'
  import { ui } from './lib/stores/ui.svelte.js'

  import Welcome from './components/Welcome.svelte'
  import TabBar from './components/TabBar.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import EditorArea from './components/EditorArea.svelte'

  import SocialComposer from './components/SocialComposer.svelte'
  import ContextMenu from './components/ContextMenu.svelte'
  import Toast from './components/Toast.svelte'
  import StatusEditor from './components/StatusEditor.svelte'
  import CleanupPreview from './components/CleanupPreview.svelte'
  import SettingsModal from './components/SettingsModal.svelte'
  import HelpPanel from './components/HelpPanel.svelte'
  import ModalDialog from './components/ModalDialog.svelte'

  // When project store signals app is ready (folder opened)
  project.onShowApp(() => {
    ui.appReady = true
  })

  // Apply dark mode class to root element
  $effect(() => {
    document.documentElement.classList.toggle('dark', ui.darkMode)
  })

  onMount(async () => {
    // Try to restore previously opened folder
    try {
      const saved = await api.getLastDirectory()
      if (saved) {
        await project.openRoot(saved)
        return
      }
    } catch (e) {
      console.error('Failed to restore folder:', e)
    }
    // If no saved folder, welcome screen shows (appReady stays false)
  })
</script>

<div class="app-root">
  {#if !ui.appReady}
    <Welcome />
  {:else}
    <TabBar />
    <div class="app-content">
      <Sidebar />
      <EditorArea />
      <SocialComposer />
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
</style>
