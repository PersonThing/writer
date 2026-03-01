<script>
  import { social } from '../lib/stores/social.svelte.js'
  import {
    preloadImage,
    renderCompositeSync,
    renderExportDataUrl,
  } from '../lib/canvas-render.js'
  import ImageSection from './social/ImageSection.svelte'
  import TextOverlaySection from './social/TextOverlaySection.svelte'
  import AudioSection from './social/AudioSection.svelte'
  import ExportSection from './social/ExportSection.svelte'

  let previewCanvas = $state(null)
  let imageReady = $state(false)

  // Preload image when imageDataUrl changes (async, only on new image)
  $effect(() => {
    const url = social.imageDataUrl
    if (!url) {
      imageReady = false
      return
    }
    preloadImage(url).then(() => {
      imageReady = true
    })
  })

  // Re-render canvas synchronously whenever overlay params change
  $effect(() => {
    if (!previewCanvas || !imageReady) return
    const overlay = {
      text: social.overlayText,
      fontFamily: social.fontFamily,
      fontSize: social.fontSize,
      fontWeight: social.fontWeight,
      fontStyle: social.fontStyle,
      fontColor: social.fontColor,
      fontOpacity: social.fontOpacity,
      textX: social.textX,
      textY: social.textY,
      textAlign: social.textAlign,
      textShadow: social.textShadow,
    }
    renderCompositeSync(previewCanvas, overlay)
    // Export at exact 1080x1080 (no DPR scaling)
    social.compositeDataUrl = renderExportDataUrl(overlay)
  })

  // Auto-save when any persistable state changes
  $effect(() => {
    if (!social.isOpen || !social.poemPath) return
    // Touch all fields we want to persist so Svelte tracks them
    social.imageSource
    social.imageDataUrl
    social.imagePrompt
    social.imageSuggestions
    social.fontFamily
    social.fontSize
    social.fontWeight
    social.fontStyle
    social.fontColor
    social.fontOpacity
    social.textX
    social.textY
    social.textAlign
    social.textShadow
    social.audioBlob
    social.audioDuration
    social.activeSection
    social.scheduleSave()
  })

  // Text position dragging on canvas
  let dragging = false

  function handleCanvasMouseDown(e) {
    dragging = true
    updateTextPosition(e)
  }

  function handleCanvasMouseMove(e) {
    if (!dragging) return
    updateTextPosition(e)
  }

  function handleCanvasMouseUp() {
    dragging = false
  }

  function updateTextPosition(e) {
    if (!previewCanvas) return
    const rect = previewCanvas.getBoundingClientRect()
    social.textX = Math.round(
      ((e.clientX - rect.left) / rect.width) * 100,
    )
    social.textY = Math.round(
      ((e.clientY - rect.top) / rect.height) * 100,
    )
  }

  function toggleSection(section) {
    social.activeSection = social.activeSection === section ? null : section
  }
</script>

{#if social.isOpen}
  <aside class="social-panel">
    <div class="sp-header">
      <span class="sp-title">Social Post</span>
      <button class="sp-close" onclick={() => social.close()}>&times;</button>
    </div>

    <div class="sp-body">
      <div class="sp-preview">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <canvas
          bind:this={previewCanvas}
          class="preview-canvas"
          class:hidden={!social.hasImage}
          onmousedown={handleCanvasMouseDown}
          onmousemove={handleCanvasMouseMove}
          onmouseup={handleCanvasMouseUp}
          onmouseleave={handleCanvasMouseUp}
        ></canvas>
        {#if !social.hasImage}
          <div class="preview-placeholder">
            <span>No image selected</span>
          </div>
        {/if}
      </div>

      <div class="sp-sections">
        <div class="sp-section">
          <button
            class="sp-section-header"
            class:active={social.activeSection === 'image'}
            onclick={() => toggleSection('image')}
          >
            <span class="sp-section-arrow"
              >{social.activeSection === 'image' ? '▾' : '▸'}</span
            >
            Image
          </button>
          {#if social.activeSection === 'image'}
            <div class="sp-section-body">
              <ImageSection />
            </div>
          {/if}
        </div>

        <div class="sp-section">
          <button
            class="sp-section-header"
            class:active={social.activeSection === 'text'}
            onclick={() => toggleSection('text')}
          >
            <span class="sp-section-arrow"
              >{social.activeSection === 'text' ? '▾' : '▸'}</span
            >
            Text Overlay
          </button>
          {#if social.activeSection === 'text'}
            <div class="sp-section-body">
              <TextOverlaySection />
            </div>
          {/if}
        </div>

        <div class="sp-section">
          <button
            class="sp-section-header"
            class:active={social.activeSection === 'audio'}
            onclick={() => toggleSection('audio')}
          >
            <span class="sp-section-arrow"
              >{social.activeSection === 'audio' ? '▾' : '▸'}</span
            >
            Voiceover
          </button>
          {#if social.activeSection === 'audio'}
            <div class="sp-section-body">
              <AudioSection />
            </div>
          {/if}
        </div>

        <div class="sp-section">
          <button
            class="sp-section-header"
            class:active={social.activeSection === 'export'}
            onclick={() => toggleSection('export')}
          >
            <span class="sp-section-arrow"
              >{social.activeSection === 'export' ? '▾' : '▸'}</span
            >
            Export
          </button>
          {#if social.activeSection === 'export'}
            <div class="sp-section-body">
              <ExportSection />
            </div>
          {/if}
        </div>
      </div>
    </div>
  </aside>
{/if}

<style>
  .social-panel {
    width: 370px;
    flex-shrink: 0;
    background: var(--surface);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.8rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .sp-title {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text);
  }
  .sp-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    border-radius: 4px;
  }
  .sp-close:hover {
    color: var(--text);
    background: var(--accent-light);
  }

  .sp-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  /* Preview canvas — padding-bottom trick for reliable 1:1 ratio */
  .sp-preview {
    margin-bottom: 0.5rem;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
    position: relative;
    width: 100%;
    padding-bottom: 100%;
  }
  .preview-canvas {
    display: block;
    cursor: crosshair;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .preview-canvas.hidden {
    visibility: hidden;
  }
  .preview-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.75rem;
    font-style: italic;
  }

  /* Accordion sections */
  .sp-sections {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sp-section {
    background: var(--surface);
  }
  .sp-section-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.4rem;
    border: none;
    background: var(--bg);
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s;
  }
  .sp-section-header:hover {
    background: var(--accent-light);
  }
  .sp-section-header.active {
    color: var(--accent);
  }
  .sp-section-arrow {
    font-size: 0.7rem;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }
  .sp-section-body {
    padding: 0.5rem 0.4rem;
  }
  .sp-placeholder {
    font-size: 0.75rem;
    color: var(--muted);
    font-style: italic;
  }
</style>
