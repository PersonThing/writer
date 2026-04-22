<script>
  import { onMount } from 'svelte'
  import { ui, toggleDarkMode } from '../../lib/stores/ui.svelte.js'
  import { auth } from '../../lib/stores/auth.svelte.js'
  import { router } from '../../lib/router.svelte.js'

  let userMenuOpen = $state(false)

  // Sync ui.activeTab from the current path. /writer/stories → short-stories,
  // anything else under /writer → poetry (default).
  $effect(() => {
    const p = router.pathname
    ui.activeTab = p === '/writer/stories' ? 'short-stories' : 'poetry'
  })

  // On first mount, if we're at bare /writer, canonicalize to /writer/poetry.
  onMount(() => {
    if (router.pathname === '/writer') router.replace('/writer/poetry')

    function onDocClick(e) {
      if (!e.target.closest('.user-menu-wrap')) userMenuOpen = false
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  })

  function setTab(tab) {
    const to = tab === 'short-stories' ? '/writer/stories' : '/writer/poetry'
    router.navigate(to)
  }

  // Cross-tab drag: when a poem is being dragged from the poetry tab,
  // hovering the "Short stories" tab switches to it so the user can
  // drop onto a specific story row in the sidebar.
  function isWriterDragPayload(e) {
    const types = Array.from(e.dataTransfer?.types || [])
    return (
      types.includes('application/x-writer-poem-path') ||
      types.includes('application/x-writer-file-path')
    )
  }

  function handleTabDragOver(e, tab) {
    if (!isWriterDragPayload(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (ui.activeTab !== tab) setTab(tab)
  }
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
    ondragover={(e) => handleTabDragOver(e, 'short-stories')}
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
  {#if auth.user}
    <div class="user-menu-wrap">
      <button
        class="user-btn"
        onclick={() => (userMenuOpen = !userMenuOpen)}
        title={auth.user.email}
      >
        {#if auth.user.picture}
          <img src={auth.user.picture} alt="" referrerpolicy="no-referrer" />
        {:else}
          <span class="user-fallback">{(auth.user.name || auth.user.email || '?').charAt(0).toUpperCase()}</span>
        {/if}
      </button>
      {#if userMenuOpen}
        <div class="user-popup" role="menu">
          <div class="user-popup-email">{auth.user.email}</div>
          <button class="user-popup-btn" onclick={() => auth.logout()}>Sign out</button>
        </div>
      {/if}
    </div>
  {/if}
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

  .user-menu-wrap {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 0.55rem;
  }
  .user-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .user-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .user-fallback {
    width: 100%;
    height: 100%;
    background: var(--accent);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .user-popup {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    min-width: 180px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .user-popup-email {
    font-size: 0.72rem;
    color: var(--muted);
    padding: 4px 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .user-popup-btn {
    background: transparent;
    border: none;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    color: var(--text);
    font-size: 0.78rem;
    font-family: var(--font-ui);
  }
  .user-popup-btn:hover {
    background: var(--accent-light);
    color: var(--accent);
  }
</style>
