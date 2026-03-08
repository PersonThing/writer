<script>
  import { social } from '../../lib/stores/social.svelte.js'
  import * as api from '../../lib/api.js'

  let promptInput = $state(social.imagePrompt || '')
  let fileInput

  // Sync local promptInput when store is restored
  $effect(() => {
    if (social.imagePrompt && !promptInput) {
      promptInput = social.imagePrompt
    }
  })

  function triggerUpload() {
    fileInput?.click()
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await api.uploadImage(file)
      social.imagePath = null
      social.imageDataUrl = result.dataUrl
      social.imageSource = 'upload'
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    // Reset input so re-selecting the same file triggers change
    e.target.value = ''
  }

  async function askClaude() {
    if (!social.poemText) return
    social.suggestingPrompts = true
    social.imageSuggestions = []
    try {
      const suggestions = await api.aiSuggestImagePrompts(social.poemText)
      social.imageSuggestions = suggestions
    } catch (e) {
      alert('Claude error: ' + e.message)
    } finally {
      social.suggestingPrompts = false
    }
  }

  function selectSuggestion(text) {
    promptInput = text
    social.imagePrompt = text
  }

  async function generateImage() {
    const prompt = promptInput.trim() || social.imagePrompt
    if (!prompt) return
    social.imageGenerating = true
    try {
      const dataUrl = await api.aiGenerateImage(prompt)
      social.imageDataUrl = dataUrl
      social.imageSource = 'generated'
      social.imagePrompt = prompt
    } catch (e) {
      alert('Image generation error: ' + e.message)
    } finally {
      social.imageGenerating = false
    }
  }

  function clearImage() {
    social.imageDataUrl = null
    social.imagePath = null
    social.imageSource = null
    social.imagePrompt = ''
    social.compositeDataUrl = null
  }
</script>

<div class="img-section">
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    style="display:none"
    onchange={handleFileSelect}
  />
  <div class="img-actions">
    <button class="btn-small" onclick={triggerUpload}>Upload Image</button>
    {#if social.hasImage}
      <button class="btn-small danger" onclick={clearImage}>Clear</button>
    {/if}
  </div>

  <hr class="sep" />

  <div class="ai-section">
    <button
      class="btn-small"
      onclick={askClaude}
      disabled={social.suggestingPrompts || !social.poemText}
    >
      {social.suggestingPrompts ? 'Thinking...' : 'Ask Claude for Ideas'}
    </button>

    {#if social.imageSuggestions.length > 0}
      <div class="suggestions">
        {#each social.imageSuggestions as suggestion, i}
          <button
            class="suggestion-chip"
            class:selected={promptInput === suggestion}
            onclick={() => selectSuggestion(suggestion)}
          >
            <span class="chip-num">{i + 1}</span>
            <span class="chip-text"
              >{suggestion.length > 80
                ? suggestion.slice(0, 80) + '...'
                : suggestion}</span
            >
          </button>
        {/each}
      </div>
    {/if}

    <textarea
      class="prompt-input"
      bind:value={promptInput}
      placeholder="Describe an image to generate..."
      rows="3"
    ></textarea>

    <button
      class="btn-small btn-primary"
      onclick={generateImage}
      disabled={social.imageGenerating || !promptInput.trim()}
    >
      {social.imageGenerating ? 'Generating...' : 'Generate with DALL-E'}
    </button>
  </div>
</div>

<style>
  .img-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .img-actions {
    display: flex;
    gap: 0.4rem;
  }
  .sep {
    border: none;
    border-top: 1px solid var(--border);
    margin: 0.2rem 0;
  }
  .ai-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .suggestions {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .suggestion-chip {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    cursor: pointer;
    text-align: left;
    font-size: 0.72rem;
    color: var(--text);
    line-height: 1.35;
    transition: all 0.1s;
  }
  .suggestion-chip:hover {
    border-color: var(--accent);
    background: var(--accent-light);
  }
  .suggestion-chip.selected {
    border-color: var(--accent);
    background: var(--accent-light);
  }
  .chip-num {
    font-weight: 700;
    color: var(--accent);
    flex-shrink: 0;
    width: 14px;
  }
  .chip-text {
    flex: 1;
    color: var(--muted);
  }
  .prompt-input {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.75rem;
    font-family: var(--font-ui);
    resize: vertical;
    line-height: 1.4;
  }
  .prompt-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .danger {
    color: #c0392b;
    border-color: #c0392b;
  }
  .danger:hover {
    background: #fdeaea;
  }
</style>
