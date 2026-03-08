<script>
  import { social } from '../../lib/stores/social.svelte.js'
  import * as api from '../../lib/api.js'

  let styling = $state(false)

  async function autoStyle() {
    styling = true
    try {
      const result = await api.aiSuggestTextStyle(
        social.overlayText,
        social.imagePrompt || 'uploaded image',
      )
      if (result.fontFamily) social.fontFamily = result.fontFamily
      if (result.fontSize) social.fontSize = result.fontSize
      if (result.fontWeight) social.fontWeight = result.fontWeight
      if (result.fontStyle) social.fontStyle = result.fontStyle
      if (result.fontColor) social.fontColor = result.fontColor
      if (result.fontOpacity != null) social.fontOpacity = result.fontOpacity
      if (result.textX != null) social.textX = result.textX
      if (result.textY != null) social.textY = result.textY
      if (result.textAlign) social.textAlign = result.textAlign
      if (result.textShadow != null) social.textShadow = result.textShadow
    } catch (e) {
      alert('Claude styling error: ' + e.message)
    } finally {
      styling = false
    }
  }
</script>

<div class="text-section">
  <div class="controls-grid">
    <label class="field-label">Font</label>
    <select class="field-select" bind:value={social.fontFamily}>
      <option value="Georgia">Georgia</option>
      <option value="system-ui">System Sans</option>
      <option value="monospace">Monospace</option>
    </select>

    <label class="field-label">Size</label>
    <div class="slider-row">
      <input
        type="range"
        min="16"
        max="72"
        bind:value={social.fontSize}
        class="field-range"
      />
      <span class="range-val">{social.fontSize}px</span>
    </div>

    <label class="field-label">Style</label>
    <div class="toggle-row">
      <button
        class="toggle-btn"
        class:on={social.fontWeight === 'bold'}
        onclick={() =>
          (social.fontWeight =
            social.fontWeight === 'bold' ? 'normal' : 'bold')}
      >
        <b>B</b>
      </button>
      <button
        class="toggle-btn"
        class:on={social.fontStyle === 'italic'}
        onclick={() =>
          (social.fontStyle =
            social.fontStyle === 'italic' ? 'normal' : 'italic')}
      >
        <i>I</i>
      </button>
      <button
        class="toggle-btn"
        class:on={social.textShadow}
        onclick={() => (social.textShadow = !social.textShadow)}
      >
        S
      </button>
    </div>

    <label class="field-label">Color</label>
    <div class="color-row">
      <input type="color" bind:value={social.fontColor} class="field-color" />
      <span class="color-hex">{social.fontColor}</span>
    </div>

    <label class="field-label">Opacity</label>
    <div class="slider-row">
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        bind:value={social.fontOpacity}
        class="field-range"
      />
      <span class="range-val">{Math.round(social.fontOpacity * 100)}%</span>
    </div>

    <label class="field-label">Position X</label>
    <div class="slider-row">
      <input
        type="range"
        min="0"
        max="100"
        bind:value={social.textX}
        class="field-range"
      />
      <span class="range-val">{social.textX}%</span>
    </div>

    <label class="field-label">Position Y</label>
    <div class="slider-row">
      <input
        type="range"
        min="0"
        max="100"
        bind:value={social.textY}
        class="field-range"
      />
      <span class="range-val">{social.textY}%</span>
    </div>

    <label class="field-label">Align</label>
    <div class="toggle-row">
      <button
        class="toggle-btn"
        class:on={social.textAlign === 'left'}
        onclick={() => (social.textAlign = 'left')}
      >
        L
      </button>
      <button
        class="toggle-btn"
        class:on={social.textAlign === 'center'}
        onclick={() => (social.textAlign = 'center')}
      >
        C
      </button>
      <button
        class="toggle-btn"
        class:on={social.textAlign === 'right'}
        onclick={() => (social.textAlign = 'right')}
      >
        R
      </button>
    </div>
  </div>

  <hr class="sep" />

  <button class="btn-small" onclick={autoStyle} disabled={styling}>
    {styling ? 'Styling...' : 'Auto-style with Claude'}
  </button>
</div>

<style>
  .text-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .field-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .controls-grid {
    display: grid;
    grid-template-columns: 65px 1fr;
    gap: 0.35rem 0.5rem;
    align-items: center;
  }
  .field-select {
    font-size: 0.75rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text);
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .field-range {
    flex: 1;
    height: 4px;
    accent-color: var(--accent);
  }
  .range-val {
    font-size: 0.68rem;
    color: var(--muted);
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .toggle-row {
    display: flex;
    gap: 0.25rem;
  }
  .toggle-btn {
    font-size: 0.72rem;
    padding: 0.2rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    transition: all 0.1s;
    min-width: 26px;
    text-align: center;
  }
  .toggle-btn:hover {
    border-color: var(--accent);
  }
  .toggle-btn.on {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .field-color {
    width: 28px;
    height: 22px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    background: none;
  }
  .color-hex {
    font-size: 0.68rem;
    color: var(--muted);
    font-family: var(--font-mono);
  }
  .sep {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.2rem 0;
  }
</style>
