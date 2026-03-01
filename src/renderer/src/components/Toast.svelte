<script>
  import { ui } from '../lib/stores/ui.svelte.js'
</script>

<div class="toast" class:show={ui.toastVisible}>{ui.toastMessage} &#10003;</div>

<style>
  .toast {
    position: fixed;
    bottom: 1.2rem;
    right: 1.2rem;
    background: #1e8a48;
    color: #fff;
    padding: 0.45rem 1rem;
    border-radius: 6px;
    font-size: 0.82rem;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
    z-index: 10000;
  }
  .toast.show {
    opacity: 1;
  }
</style>
