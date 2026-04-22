<script>
  let { data, onSelectCharacter } = $props()

  // Layout: arrange characters on a circle; user can drag to refine.
  let container = $state(null)
  let positions = $state(new Map()) // id -> { x, y }
  let dragging = $state(null)
  let hovered = $state(null)
  let selected = $state(null)

  // Enrich the LLM's relationship list with scene-co-occurrence data.
  // For every pair of characters that share at least one scene and
  // wasn't already linked by the LLM, we add a synthetic edge labeled
  // with the scene count. This catches minor-character links the LLM
  // often omits.
  let enrichedRelationships = $derived.by(() => {
    const rels = [...(data?.relationships || [])]
    const seen = new Set()
    const pairKey = (a, b) => (a < b ? a + '||' + b : b + '||' + a)
    for (const r of rels) {
      if (r.from && r.to && r.from !== r.to) seen.add(pairKey(r.from, r.to))
    }

    // Count co-occurrences across scenes.
    const cooccur = new Map() // pairKey -> count
    for (const s of data?.scenes || []) {
      const ids = [...new Set(s.characterIds || [])]
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = pairKey(ids[i], ids[j])
          cooccur.set(k, (cooccur.get(k) || 0) + 1)
        }
      }
    }

    for (const [key, count] of cooccur) {
      if (seen.has(key)) continue
      const [a, b] = key.split('||')
      rels.push({
        from: a,
        to: b,
        label: count === 1 ? 'shares 1 scene' : 'shares ' + count + ' scenes',
        strength: Math.min(3, count),
        summary: 'Appears together in ' + count + ' scene' + (count === 1 ? '' : 's') + '.',
        derived: true,
      })
    }
    return rels
  })

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

  // For each (from, to) pair, how many parallel edges exist and which
  // slot is this edge? Used to fan out multiple relationships between
  // the same two characters so lines and labels don't overlap.
  let parallelInfo = $derived.by(() => {
    const groups = new Map()
    for (const r of enrichedRelationships) {
      const key = r.from < r.to ? `${r.from}||${r.to}` : `${r.to}||${r.from}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    }
    const info = new Map() // relationship reference -> { index, total }
    for (const [, group] of groups) {
      group.forEach((r, i) => info.set(r, { index: i, total: group.length }))
    }
    return info
  })

  function curveOffset(rel) {
    const info = parallelInfo.get(rel) || { index: 0, total: 1 }
    // Symmetric fan: single edge centered, multiples spread out.
    const base = 18
    if (info.total === 1) return base
    // Alternate sides: first on one side, next on the other, etc.
    const spread = 22
    return base + (info.index - (info.total - 1) / 2) * spread
  }

  function edgeGeometry(a, b, rel) {
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const offset = curveOffset(rel)
    const cx = mx + nx * offset
    const cy = my + ny * offset
    // Label sits on the curve midpoint, which is the quadratic's midpoint.
    const lx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x
    const ly = 0.25 * a.y + 0.5 * cy + 0.25 * b.y
    const path = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
    return { path, lx, ly }
  }

  function nodeRadius(degree) {
    return 22 + Math.min(18, degree * 3)
  }

  let degrees = $derived.by(() => {
    const m = new Map()
    for (const r of enrichedRelationships) {
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
      {#each enrichedRelationships as rel}
        {@const a = positions.get(rel.from)}
        {@const b = positions.get(rel.to)}
        {#if a && b}
          {@const geom = edgeGeometry(a, b, rel)}
          <path
            d={geom.path}
            stroke-width={rel.strength || 1}
            class="edge"
            class:dim={selected && selected !== rel.from && selected !== rel.to}
            class:derived={rel.derived}
          />
          {#if rel.label}
            <text
              x={geom.lx}
              y={geom.ly - 4}
              class="edge-label"
              class:derived={rel.derived}
              text-anchor="middle"
            >{rel.label}</text>
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
  /* Derived (scene-co-occurrence) edges are lighter + dashed so the
     reader can tell them apart from LLM-authored relationship edges. */
  .edge.derived {
    stroke-dasharray: 4 3;
    opacity: 0.4;
  }
  .edge-label {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--muted);
    pointer-events: none;
  }
  .edge-label.derived {
    font-style: italic;
    opacity: 0.75;
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
