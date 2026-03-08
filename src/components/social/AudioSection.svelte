<script>
  import { social } from '../../lib/stores/social.svelte.js'

  let mediaRecorder = null
  let chunks = []
  let recordingTime = $state(0)
  let timerInterval = null

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        social.audioBlob = blob
        social.audioUrl = URL.createObjectURL(blob)
        social.audioDuration = recordingTime
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start(100)
      social.isRecording = true
      recordingTime = 0
      timerInterval = setInterval(() => recordingTime++, 1000)
    } catch (e) {
      alert('Microphone access denied: ' + e.message)
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    social.isRecording = false
    clearInterval(timerInterval)
    timerInterval = null
  }

  function clearRecording() {
    if (social.audioUrl) URL.revokeObjectURL(social.audioUrl)
    social.audioBlob = null
    social.audioUrl = null
    social.audioDuration = 0
    recordingTime = 0
  }
</script>

<div class="audio-section">
  {#if social.isRecording}
    <div class="recording-row">
      <span class="rec-dot"></span>
      <span class="rec-time">{formatTime(recordingTime)}</span>
      <button class="btn-small rec-stop" onclick={stopRecording}>Stop</button>
    </div>
  {:else if social.audioUrl}
    <div class="playback">
      <audio controls src={social.audioUrl} class="audio-player">
        <track kind="captions" />
      </audio>
      <div class="playback-actions">
        <span class="duration">{formatTime(social.audioDuration)}</span>
        <button class="btn-small" onclick={startRecording}>Re-record</button>
        <button class="btn-small danger" onclick={clearRecording}>Clear</button>
      </div>
    </div>
  {:else}
    <button class="btn-small" onclick={startRecording}>Record Voiceover</button>
    <p class="audio-hint">Record a reading of your poem to create a video reel</p>
  {/if}
</div>

<style>
  .audio-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .recording-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem;
    border: 1px solid #c0392b;
    border-radius: 6px;
    background: #fdeaea;
  }
  :global(.dark) .recording-row {
    background: #2a1a1a;
    border-color: #8b3030;
  }
  .rec-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #c0392b;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
  .rec-time {
    font-size: 0.82rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #c0392b;
    flex: 1;
  }
  :global(.dark) .rec-time {
    color: #e06060;
  }
  .rec-stop {
    color: #c0392b;
    border-color: #c0392b;
  }
  .playback {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .audio-player {
    width: 100%;
    height: 32px;
    border-radius: 6px;
  }
  .playback-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .duration {
    font-size: 0.72rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    flex: 1;
  }
  .audio-hint {
    font-size: 0.7rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.3;
  }
  .danger {
    color: #c0392b;
    border-color: #c0392b;
  }
  .danger:hover {
    background: #fdeaea;
  }
</style>
