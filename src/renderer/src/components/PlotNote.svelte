<script>
  let {
    note, selected = false, connecting = false,
    connectedSides = { top: false, bottom: false, left: false, right: false },
    onmove, onselect, onupdate, ondelete, onopenfile, oncolorchange,
    onportclick, onportdragstart,
  } = $props()

  let dragging = $state(false)
  let hovered = $state(false)
  let dragOffset = { x: 0, y: 0 }

  const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa']
  const SIDES = ['top', 'bottom', 'left', 'right']

  function startDrag(e) {
    if (e.target.closest('textarea, .color-picker, .note-delete, .note-link, .port')) return
    e.preventDefault()
    dragging = true
    const rect = e.currentTarget.getBoundingClientRect()
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    onselect?.(note.id)

    function onMove(e) {
      if (!dragging) return
      const parent = document.querySelector('.plot-canvas')
      if (!parent) return
      const parentRect = parent.getBoundingClientRect()
      const x = Math.max(0, e.clientX - parentRect.left - dragOffset.x + parent.scrollLeft)
      const y = Math.max(0, e.clientY - parentRect.top - dragOffset.y + parent.scrollTop)
      onmove?.(note.id, x, y)
    }

    function onUp() {
      dragging = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleInput(e) {
    onupdate?.(note.id, { text: e.target.value })
  }

  function handleClick(e) {
    onselect?.(note.id)
  }

  function handlePortPointerDown(side, e) {
    e.stopPropagation()
    onportdragstart?.(note.id, side, e)
  }

  function handlePortClick(side, e) {
    e.stopPropagation()
    onportclick?.(note.id, side)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="plot-note"
  class:selected
  class:connecting
  class:dragging
  data-note-id={note.id}
  style="left: {note.x}px; top: {note.y}px; background: {note.color || '#fef08a'};"
  onpointerdown={startDrag}
  onclick={handleClick}
  onpointerenter={() => hovered = true}
  onpointerleave={() => hovered = false}
>
  <textarea
    class="note-input"
    value={note.text || ''}
    oninput={handleInput}
    placeholder="Write something..."
    rows="3"
  ></textarea>

  {#if note.file}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="note-link" onclick={(e) => { e.stopPropagation(); onopenfile?.(note.file) }}>{note.file}</div>
  {/if}

  {#if selected}
    <div class="color-picker">
      {#each NOTE_COLORS as color}
        <button
          class="color-swatch"
          class:active={note.color === color}
          style="background: {color};"
          onclick={(e) => { e.stopPropagation(); oncolorchange?.(note.id, color) }}
        ></button>
      {/each}
    </div>
    <button class="note-delete" onclick={(e) => { e.stopPropagation(); ondelete?.(note.id) }}>&times;</button>
  {/if}

  <!-- Connection ports on all 4 sides -->
  {#each SIDES as side}
    {#if hovered || selected || connecting || connectedSides[side]}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="port port-{side}"
        class:connected={connectedSides[side]}
        data-port={side}
        data-note-id={note.id}
        onpointerdown={(e) => handlePortPointerDown(side, e)}
        onclick={(e) => handlePortClick(side, e)}
      ></div>
    {/if}
  {/each}
</div>

<style>
  .plot-note {
    position: absolute;
    width: 180px;
    min-height: 60px;
    padding: 0.55rem 0.65rem;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    cursor: grab;
    user-select: none;
    font-size: 0.75rem;
    color: #1a1a1a;
    transition: box-shadow 0.12s;
    z-index: 2;
  }
  .plot-note:hover {
    box-shadow: 0 3px 12px rgba(0,0,0,0.35);
  }
  .plot-note.selected {
    box-shadow: 0 0 0 2px var(--accent), 0 3px 12px rgba(0,0,0,0.3);
  }
  .plot-note.dragging {
    cursor: grabbing;
    opacity: 0.9;
    z-index: 10;
  }
  .plot-note.connecting {
    cursor: crosshair;
  }

  .note-input {
    width: 100%;
    background: rgba(255,255,255,0.4);
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 0.25rem 0.35rem;
    font-size: 0.75rem;
    color: #1a1a1a;
    outline: none;
    font-family: inherit;
    resize: none;
    cursor: text;
    line-height: 1.4;
  }
  .note-input:focus {
    background: rgba(255,255,255,0.6);
    border-color: rgba(0,0,0,0.15);
  }

  .note-link {
    margin-top: 4px;
    font-size: 0.65rem;
    color: #4a68b0;
    font-style: italic;
    cursor: pointer;
  }

  .color-picker {
    display: flex;
    gap: 3px;
    margin-top: 6px;
  }
  .color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 2px solid rgba(0,0,0,0.15);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .color-swatch:hover {
    border-color: rgba(0,0,0,0.4);
  }
  .color-swatch.active {
    border-color: rgba(0,0,0,0.6);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
  }

  .note-delete {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #e55;
    color: #fff;
    border: none;
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
  }

  /* Connection ports */
  .port {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent, #8b7355);
    border: 2px solid rgba(255,255,255,0.8);
    cursor: crosshair;
    z-index: 5;
    opacity: 0.6;
    transition: opacity 0.12s, transform 0.12s;
  }
  .port:hover {
    opacity: 1;
    transform: scale(1.3);
  }
  .port.connected {
    opacity: 0.9;
    background: var(--accent, #8b7355);
  }
  .port-top {
    top: -7px;
    left: 50%;
    margin-left: -7px;
  }
  .port-bottom {
    bottom: -7px;
    left: 50%;
    margin-left: -7px;
  }
  .port-left {
    left: -7px;
    top: 50%;
    margin-top: -7px;
  }
  .port-right {
    right: -7px;
    top: 50%;
    margin-top: -7px;
  }
</style>
