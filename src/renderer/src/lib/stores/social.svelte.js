import * as api from '../api.js'
import { project } from './project.svelte.js'

class SocialComposerStore {
  // Panel
  isOpen = $state(false)
  poemPath = $state(null)
  poemText = $state('')

  // Image
  imageSource = $state(null) // 'upload' | 'generated'
  imagePath = $state(null)
  imageDataUrl = $state(null)
  imagePrompt = $state('')
  imageGenerating = $state(false)
  imageSuggestions = $state([])
  suggestingPrompts = $state(false)

  // Text overlay
  overlayText = $state('')
  fontFamily = $state('Georgia')
  fontSize = $state(32)
  fontWeight = $state('normal')
  fontStyle = $state('normal')
  fontColor = $state('#ffffff')
  fontOpacity = $state(1.0)
  textX = $state(50)
  textY = $state(50)
  textAlign = $state('center')
  textShadow = $state(true)

  // Audio
  isRecording = $state(false)
  audioBlob = $state(null)
  audioUrl = $state(null)
  audioDuration = $state(0)

  // Composite output
  compositeDataUrl = $state(null)

  // Active accordion section
  activeSection = $state('image')

  // Auto-save internals
  #saveTimer = null
  #restoring = false

  get hasImage() {
    return !!this.imageDataUrl
  }
  get hasAudio() {
    return !!this.audioBlob
  }
  get canExport() {
    return !!this.compositeDataUrl
  }

  async open(poemPath, poemText) {
    this.poemPath = poemPath
    this.poemText = poemText
    this.overlayText = this.#extractPoemBody(poemText)
    this.isOpen = true

    // Try to restore saved state
    if (project.rootPath) {
      try {
        const saved = await api.socialLoad(project.rootPath, poemPath)
        if (saved) {
          this.#restore(saved, poemText)
          return
        }
      } catch (e) {
        console.error('Failed to restore social state:', e)
      }
    }
  }

  close() {
    // Save before closing
    this.#saveNow()
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl)
    this.isOpen = false
    this.poemPath = null
    this.poemText = ''
    this.imageSource = null
    this.imagePath = null
    this.imageDataUrl = null
    this.imagePrompt = ''
    this.imageGenerating = false
    this.imageSuggestions = []
    this.suggestingPrompts = false
    this.overlayText = ''
    this.fontFamily = 'Georgia'
    this.fontSize = 32
    this.fontWeight = 'normal'
    this.fontStyle = 'normal'
    this.fontColor = '#ffffff'
    this.fontOpacity = 1.0
    this.textX = 50
    this.textY = 50
    this.textAlign = 'center'
    this.textShadow = true
    this.isRecording = false
    this.audioBlob = null
    this.audioUrl = null
    this.audioDuration = 0
    this.compositeDataUrl = null
    this.activeSection = 'image'
  }

  // Schedule a debounced save (called from $effect in SocialComposer)
  scheduleSave() {
    if (this.#restoring) return
    if (this.#saveTimer) clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => this.#saveNow(), 1000)
  }

  async #saveNow() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer)
      this.#saveTimer = null
    }
    if (!this.poemPath || !project.rootPath) return

    // Convert audio blob to base64 for saving
    let audioBase64 = null
    if (this.audioBlob) {
      try {
        const buffer = await this.audioBlob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        audioBase64 = `data:audio/webm;base64,${btoa(binary)}`
      } catch (e) {
        console.error('Failed to serialize audio:', e)
      }
    }

    // JSON round-trip to strip Svelte 5 $state proxies (IPC structured clone fails on Proxies)
    const state = JSON.parse(
      JSON.stringify({
        imageSource: this.imageSource,
        imagePath: this.imagePath,
        imageDataUrl: this.imageDataUrl,
        imagePrompt: this.imagePrompt,
        imageSuggestions: this.imageSuggestions,
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        fontColor: this.fontColor,
        fontOpacity: this.fontOpacity,
        textX: this.textX,
        textY: this.textY,
        textAlign: this.textAlign,
        textShadow: this.textShadow,
        audioDuration: this.audioDuration,
        audioBase64,
        activeSection: this.activeSection,
      }),
    )

    try {
      await api.socialSave(project.rootPath, this.poemPath, state)
    } catch (e) {
      console.error('Failed to auto-save social state:', e)
    }
  }

  #restore(saved, poemText) {
    this.#restoring = true

    this.imageSource = saved.imageSource || null
    this.imagePath = saved.imagePath || null
    this.imageDataUrl = saved.imageDataUrl || null
    this.imagePrompt = saved.imagePrompt || ''
    this.imageSuggestions = saved.imageSuggestions || []
    this.overlayText = this.#extractPoemBody(poemText)
    this.fontFamily = saved.fontFamily || 'Georgia'
    this.fontSize = saved.fontSize ?? 32
    this.fontWeight = saved.fontWeight || 'normal'
    this.fontStyle = saved.fontStyle || 'normal'
    this.fontColor = saved.fontColor || '#ffffff'
    this.fontOpacity = saved.fontOpacity ?? 1.0
    this.textX = saved.textX ?? 50
    this.textY = saved.textY ?? 50
    this.textAlign = saved.textAlign || 'center'
    this.textShadow = saved.textShadow ?? true
    this.audioDuration = saved.audioDuration || 0
    this.activeSection = saved.activeSection || 'image'

    // Restore audio from base64
    if (saved.audioBase64) {
      try {
        const base64 = saved.audioBase64.split(',')[1]
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        this.audioBlob = new Blob([bytes], { type: 'audio/webm' })
        this.audioUrl = URL.createObjectURL(this.audioBlob)
      } catch (e) {
        console.error('Failed to restore audio:', e)
        this.audioBlob = null
        this.audioUrl = null
      }
    }

    // Let the next tick finish before allowing saves
    setTimeout(() => {
      this.#restoring = false
    }, 100)
  }

  #extractPoemBody(md) {
    return md
      .replace(/^#.*\n+/, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s/gm, '')
      .replace(/^>\s?/gm, '')
      .trim()
  }
}

export const social = new SocialComposerStore()
