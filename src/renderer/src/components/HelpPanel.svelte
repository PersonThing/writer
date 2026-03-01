<script>
  import { ui } from '../lib/stores/ui.svelte.js'

  function close() {
    ui.helpOpen = false
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close()
  }

  const isMac = navigator.platform.includes('Mac')
  const mod = isMac ? 'Cmd' : 'Ctrl'
</script>

{#if ui.helpOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} role="dialog">
    <div class="modal-box">
      <div class="modal-header">
        <span>Keyboard Shortcuts & Help</span>
        <button class="modal-close" onclick={close}>&times;</button>
      </div>

      <div class="section">
        <h3>File Management</h3>
        <div class="shortcut"><kbd>Click</kbd> file in sidebar to open</div>
        <div class="shortcut">
          <kbd>{mod}+Click</kbd> file to open side-by-side (up to 3)
        </div>
        <div class="shortcut"><kbd>+</kbd> button to create a new file</div>
        <div class="shortcut">
          <kbd>Right-click</kbd> file for status, quality, rename, delete
        </div>
      </div>

      <div class="section">
        <h3>Editing</h3>
        <div class="shortcut"><kbd>{mod}+S</kbd> Save</div>
        <div class="shortcut"><kbd>{mod}+Z</kbd> Undo</div>
        <div class="shortcut">
          <kbd>{mod}+Shift+Z</kbd> / <kbd>{mod}+Y</kbd> Redo
        </div>
        <div class="shortcut"><kbd>Tab</kbd> Insert 2 spaces</div>
      </div>

      <div class="section">
        <h3>Formatting</h3>
        <div class="shortcut"><kbd>{mod}+B</kbd> Bold</div>
        <div class="shortcut"><kbd>{mod}+I</kbd> Italic</div>
        <div class="shortcut">
          <kbd>{mod}+1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> Heading 1 / 2 / 3
        </div>
        <div class="shortcut"><kbd>{mod}+K</kbd> Insert link</div>
        <div class="shortcut">
          <kbd>{mod}+Enter</kbd> Poetry line break (trailing \)
        </div>
        <div class="shortcut"><kbd>{mod}+\</kbd> Horizontal rule (---)</div>
        <div class="shortcut"><kbd>{mod}+D</kbd> Duplicate line</div>
        <div class="shortcut"><kbd>{mod}+Shift+L</kbd> Bullet list</div>
        <div class="shortcut"><kbd>{mod}+Shift+.</kbd> Em dash (&mdash;)</div>
        <div class="shortcut">
          <kbd>Shift+F3</kbd> Cycle case: UPPER / Title / lower
        </div>
      </div>

      <div class="section">
        <h3>Multi-Pane</h3>
        <p class="hint">
          {mod}+Click on a file opens it side-by-side. Up to 3 panes can be
          open. Click into a pane to make it active — all shortcuts apply to the
          active pane. Multi-pane locks to edit-only view.
        </p>
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
    padding: 1.5rem;
    min-width: 420px;
    max-width: 520px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 1rem;
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
    margin-bottom: 1rem;
  }
  h3 {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    margin-bottom: 0.4rem;
  }
  .shortcut {
    font-size: 0.82rem;
    padding: 0.2rem 0;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  kbd {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--text);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--muted);
    line-height: 1.5;
  }
</style>
