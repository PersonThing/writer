<script>
  import { social } from '../../lib/stores/social.svelte.js'
  import { showToast } from '../../lib/stores/ui.svelte.js'
  import * as api from '../../lib/api.js'

  let exporting = $state(false)
  let exportStatus = $state('')

  function saveImage() {
    if (!social.compositeDataUrl) return
    api.downloadDataUrl(social.compositeDataUrl, 'social-post.jpg')
    showToast('Image downloaded')
  }

  async function createAndSaveVideo() {
    if (!social.compositeDataUrl || !social.audioBlob) return
    exporting = true
    exportStatus = 'Creating video...'
    try {
      const videoBlob = await api.createReel(
        social.compositeDataUrl,
        social.audioBlob,
        social.audioDuration,
      )

      api.downloadBlob(videoBlob, 'social-reel.mp4')
      showToast('Video downloaded')
      exportStatus = ''
    } catch (e) {
      exportStatus = 'Error: ' + e.message
    } finally {
      exporting = false
    }
  }
</script>

<div class="export-section">
  <button
    class="btn-small btn-primary"
    onclick={saveImage}
    disabled={!social.compositeDataUrl}
  >
    Save Image
  </button>

  <button
    class="btn-small btn-primary"
    onclick={createAndSaveVideo}
    disabled={!social.compositeDataUrl || !social.hasAudio || exporting}
  >
    {exporting ? exportStatus || 'Creating...' : 'Save Video (Image + Audio)'}
  </button>

  {#if !social.hasAudio}
    <p class="export-hint">Record a voiceover to enable video export</p>
  {/if}

  {#if !social.compositeDataUrl}
    <p class="export-hint">Add an image to enable export</p>
  {/if}

  {#if exportStatus && !exporting}
    <p class="export-status" class:error={exportStatus.startsWith('Error')}>
      {exportStatus}
    </p>
  {/if}
</div>

<style>
  .export-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .export-hint {
    font-size: 0.7rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.3;
  }
  .export-status {
    font-size: 0.72rem;
    color: var(--accent);
    font-weight: 500;
  }
  .export-status.error {
    color: #c0392b;
  }
</style>
