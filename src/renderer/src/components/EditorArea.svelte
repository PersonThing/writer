<script>
  import { editor } from '../lib/stores/editor.svelte.js';
  import EditorPane from './EditorPane.svelte';

  // beforeunload warning
  $effect(() => {
    function handleBeforeUnload(e) {
      if (editor.anyDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<div class="editor-area">
  {#if editor.panes.length === 0}
    <div class="no-file">&larr; Select a poem to read or edit</div>
  {:else}
    <div class="panes-container">
      {#each editor.panes as pane (pane.id)}
        <EditorPane
          {pane}
          isActive={pane.id === editor.activePaneId}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .editor-area {
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden; background: var(--surface);
  }
  .no-file {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-family: var(--font-serif);
    font-style: italic; font-size: 1.05rem;
  }
  .panes-container {
    flex: 1; display: flex; overflow: hidden;
  }
</style>
