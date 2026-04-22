<script>
  let { data, onSelectCharacter } = $props()

  // Layout: arrange characters on a circle; user can drag to refine.
  let container = $state(null)
  let positions = $state(new Map()) // id -> { x, y }
  let dragging = $state(null)
  let hovered = $state(null)
  let selected = $state(null)

  function layoutFor(chars, width, height) {
    const map = new Map()
    const n = chars.length
    if (!n) return map
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) * 0.35
    chars.forEach((c, i) => {
      if (n === 1) {
        map.set(c.id, { x: cx, y: cy })
      } else {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        map.set(c.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
      }
    })
    return map
  }

  $effect(() => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    positions = layoutFor(data?.characters || [], rect.width, rect.height)
  })

  function startDrag(e, id) {
    e.preventDefault()
    const rect = container.getBoundingClientRect()
    dragging = { id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
  }

  function onMove(e) {
    if (!dragging) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left))
    const y = Math.max(32, Math.min(rect.height - 32, e.clientY - rect.top))
    const next = new Map(positions)
    next.set(dragging.id, { x, y })
    positions = next
  }

  function endDrag() {
    dragging = null
  }

  function selectNode(id) {
    selected = id
    onSelectCharacter?.(id)
  }

  function edgePath(a, b) {
    if (!a || !b) return ''
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    // Gentle curve offset perpendicular to the edge for readability
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const offset = 18
    const cx = mx + nx * offset
    const cy = my + ny * offset
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
  }

  function nodeRadius(degree) {
    return 22 + Math.min(18, degree * 3)
  }

  let degrees = $derived.by(() => {
    const m = new Map()
    for (const r of data?.relationships || []) {
      m.set(r.from, (m.get(r.from) || 0) + 1)
      m.set(r.to, (m.get(r.to) || 0) + 1)
    }
    return m
  })
</script>

<svelte:window onmousemove={onMove} onmouseup={endDrag} />

<div
  class="graph-wrap"
  bind:this={container}
>
  <svg class="graph-svg" width="100%" height="100%">
    <g class="edges">
      {#each (data?.relationships || []) as rel}
        {@const a = positions.get(rel.from)}
        {@const b = positions.get(rel.to)}
        {#if a && b}
          {@const mx = (a.x + b.x) / 2}
          {@const my = (a.y + b.y) / 2}
          <path
            d={edgePath(a, b)}
            stroke-width={rel.strength || 1}
            class="edge"
            class:dim={selected && selected !== rel.from && selected !== rel.to}
          />
          {#if rel.label}
            <text x={mx} y={my - 4} class="edge-label" text-anchor="middle">
              {rel.label}
            </text>
          {/if}
        {/if}
      {/each}
    </g>

    <g class="nodes">
      {#each (data?.characters || []) as char}
        {@const pos = positions.get(char.id)}
        {#if pos}
          {@const r = nodeRadius(degrees.get(char.id) || 0)}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
          <g
            class="node"
            class:selected={selected === char.id}
            class:dim={selected && selected !== char.id}
            transform="translate({pos.x}, {pos.y})"
            onmousedown={(e) => startDrag(e, char.id)}
            onmouseenter={() => (hovered = char.id)}
            onmouseleave={() => (hovered = null)}
            onclick={() => selectNode(char.id)}
          >
            <circle r={r} class="node-circle" />
            <text class="node-label" text-anchor="middle" dy=".35em">
              {char.name}
            </text>
          </g>
        {/if}
      {/each}
    </g>
  </svg>

  {#if !(data?.characters?.length)}
    <div class="empty">No characters detected.</div>
  {/if}
</div>

<style>
  .graph-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: var(--bg);
  }
  .graph-svg { display: block; width: 100%; height: 100%; }

  .edge {
    fill: none;
    stroke: var(--muted);
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .edge.dim { opacity: 0.12; }
  .edge-label {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--muted);
    pointer-events: none;
  }

  .node { cursor: grab; }
  .node:active { cursor: grabbing; }
  .node.dim { opacity: 0.3; }
  .node-circle {
    fill: var(--surface);
    stroke: var(--accent);
    stroke-width: 2;
    transition: filter 0.15s;
  }
  .node.selected .node-circle {
    fill: var(--accent);
  }
  .node.selected .node-label {
    fill: #fff;
  }
  .node:hover .node-circle {
    filter: brightness(1.1);
  }
  .node-label {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    fill: var(--text);
    pointer-events: none;
    user-select: none;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-style: italic;
  }
</style>
