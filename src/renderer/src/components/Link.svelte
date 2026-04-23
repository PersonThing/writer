<script>
  import { router } from '../lib/router.svelte.js'

  let { href, class: cls = '', children, onclick: userOnClick, ...rest } = $props()

  function handleClick(e) {
    // Fire any caller-provided onclick first so it can mark state (e.g.
    // "close dropdown") even when we take over navigation.
    userOnClick?.(e)
    if (e.defaultPrevented) return

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
