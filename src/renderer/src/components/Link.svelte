<script>
  import { router } from '../lib/router.svelte.js'

  let { href, class: cls = '', children, ...rest } = $props()

  function handleClick(e) {
    // Let modified clicks behave normally (new tab/window/download)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (e.button !== 0) return

    // External / cross-origin — let the browser handle it
    try {
      const url = new URL(href, window.location.origin)
      if (url.origin !== window.location.origin) return
    } catch {
      return
    }

    e.preventDefault()
    router.navigate(href)
  }
</script>

<a {href} class={cls} onclick={handleClick} {...rest}>{@render children?.()}</a>
