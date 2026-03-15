<script>
  let { onapply } = $props();

  const buttons = [
    { fmt: 'bold', label: '<b>B</b>', tip: 'Bold (Ctrl+B)' },
    { fmt: 'italic', label: '<i>I</i>', tip: 'Italic (Ctrl+I)' },
    { fmt: 'strikethrough', label: '<s>S</s>', tip: 'Strikethrough (Ctrl+Shift+X)' },
    null, // separator
    { fmt: 'h1', label: 'H1', tip: 'Heading 1 (Ctrl+1)' },
    { fmt: 'h2', label: 'H2', tip: 'Heading 2 (Ctrl+2)' },
    { fmt: 'h3', label: 'H3', tip: 'Heading 3 (Ctrl+3)' },
    null,
    { fmt: 'link', label: '&#128279;', tip: 'Link (Ctrl+K)' },
    { fmt: 'hr', label: '&#9135;', tip: 'Section break (Ctrl+\\)' },
    { fmt: 'bullet', label: '&#8226; List', tip: 'Bullet list (Ctrl+Shift+L)' },
    null,
    { fmt: 'poetry-br', label: '&#8629;\\', tip: 'Poetry line break (Ctrl+Enter)' },
    { fmt: 'em-dash', label: '&#8212;', tip: 'Em dash (Ctrl+Shift+.)' },
    { fmt: 'dup-line', label: '&#10697;', tip: 'Duplicate line (Ctrl+D)' },
    null,
    { fmt: 'case', label: 'Aa', tip: 'Cycle case (Shift+F3)' },
  ];

  function handleClick(fmt) {
    if (onapply) onapply(fmt);
  }
</script>

<div class="fmt-bar">
  {#each buttons as btn}
    {#if btn === null}
      <span class="fmt-sep"></span>
    {:else}
      <button
        class="fmt-btn"
        data-tip={btn.tip}
        onclick={() => handleClick(btn.fmt)}
      >{@html btn.label}</button>
    {/if}
  {/each}
</div>

<style>
  .fmt-bar {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
    padding: .28rem .55rem; border-bottom: 1px solid var(--border);
    background: var(--bg); flex-shrink: 0;
  }
  .fmt-btn {
    font-size: .72rem; padding: .22rem .42rem; border-radius: 4px;
    border: 1px solid transparent; background: transparent;
    cursor: pointer; color: var(--text); font-family: var(--font-ui);
    transition: background .1s, border-color .1s, color .1s;
    white-space: nowrap; position: relative;
  }
  .fmt-btn:hover {
    background: var(--accent-light); border-color: var(--border); color: var(--accent);
  }
  .fmt-btn[data-tip]:hover::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 5px); left: 50%;
    transform: translateX(-50%);
    background: #2a2a2a; color: #f0f0f0; font-size: .65rem;
    padding: 3px 8px; border-radius: 4px; white-space: nowrap;
    pointer-events: none; z-index: 9999;
    box-shadow: 0 2px 6px rgba(0,0,0,.25);
  }
  .fmt-sep {
    width: 1px; height: 16px; background: var(--border); margin: 0 3px; flex-shrink: 0;
  }
</style>
