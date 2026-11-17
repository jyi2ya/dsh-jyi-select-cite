/**
 * select-cite client: anchored popover → composer draft.
 *
 * Consumes the 'selection/anchor' client event that dsh-jyi-hackyapi publishes
 * from the document selection; owns only the popover UI (preset search,
 * comment input) and the draft fill.
 *
 * The preset table lives in presets.json (served by the host half at
 * /api/select-cite/presets, re-read on every box open — editing the file
 * applies with no restart and no refresh). FALLBACK_PRESETS below only seeds
 * the dropdown while that fetch is unavailable.
 */
window.__ModuleLoader__.load({
  id: 'dsh-jyi-select-cite',
  factory: function (require) {
    const React = require('react')
    const reactDom = require('react-dom')
    const createPortal = reactDom && reactDom.createPortal
    const kit = require('dsh-jyi-hackyapi')
    const h = React.createElement

    // ===== Fallback E-code table while the presets route is unreachable =====
    const FALLBACK_PRESETS = [
      { code: 'E01', text: 'overclaims capability here' },
      { code: 'E02', text: 'undefined behavior on empty input' },
      { code: 'E03', text: 'race condition between these two paths' },
      { code: 'E04', text: 'error swallowed silently' },
      { code: 'E05', text: 'type assertion bypasses the check' },
      { code: 'E06', text: 'duplicates logic from another module' },
      { code: 'E07', text: 'missing test for this branch' },
      { code: 'E08', text: 'naming does not match behavior' },
      { code: 'E09', text: 'unbounded loop / missing exit condition' },
      { code: 'E10', text: 'depends on an undocumented internal' },
    ]

    // Friendly labels for the chat flow kinds carried by the anchor event.
    const KIND_LABELS = {
      user: '用户消息',
      steering: '用户输入',
      'turn-trigger': '触发消息',
      'turn-process': '回合过程',
      assistant: '助手消息',
      'assistant-step': '助手步骤',
      tool: '工具消息',
      compaction: '压缩摘要',
    }

    /** Raw location text without the parentheses wrapper, or '' when unknown. */
    function locationText(anchor) {
      if (!anchor) return ''
      if (anchor.kind === 'chat' && anchor.turn !== undefined) {
        const kind = anchor.nodeKind || '消息'
        return `第 ${anchor.turn} 轮 · ${KIND_LABELS[kind] || kind}`
      }
      if ((anchor.kind === 'diff' || anchor.kind === 'document') && anchor.file !== undefined) {
        const start = anchor.startLine ?? 0
        const end = anchor.endLine ?? anchor.startLine ?? 0
        const low = Math.min(start, end)
        const high = Math.max(start, end)
        const range = start > 0 && end > 0 && low !== high ? `${low}-${high}` : String(low > 0 ? low : '?')
        const sideText = anchor.side === 'old' ? ' · 旧侧' : anchor.side === 'new' ? ' · 新侧' : ''
        const pageText = anchor.page === undefined || anchor.page === null ? '' : ` · 第 ${anchor.page} 页`
        return `${anchor.file}:${range}${sideText}${pageText}`
      }
      return ''
    }

    function buildDraft(quote, comment, anchor) {
      const quoted = quote
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')
      const loc = locationText(anchor)
      const locationLine = loc === '' ? '' : `（位置：${loc}）\n`
      return `${locationLine}${quoted}\n\n${comment.trim()}`
    }

    /** Fuzzy match over code, text, and the optional clippy-style detail. */
    function matchesPreset(preset, q) {
      if (q === '') return true
      if (preset.code.toLowerCase().includes(q)) return true
      if (preset.text.toLowerCase().includes(q)) return true
      return typeof preset.detail === 'string' && preset.detail.toLowerCase().includes(q)
    }

    const BOX_STYLE = {
      position: 'fixed',
      zIndex: 10000,
      width: 420,
      maxWidth: 'calc(100vw - 32px)',
      background: 'var(--dsw-alias-bg-layer-1, #ffffff)',
      color: 'var(--dsw-alias-fg-primary, #1f2328)',
      border: '1px solid rgba(128, 128, 128, 0.5)',
      borderRadius: 10,
      boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22)',
      padding: '10px 12px',
      fontFamily: 'inherit',
      fontSize: 13,
      lineHeight: 1.5,
    }
    const INPUT_STYLE = {
      width: '100%',
      boxSizing: 'border-box',
      background: 'var(--dsw-alias-bg-layer-2, #ffffff)',
      color: 'var(--dsw-alias-fg-primary, #1f2328)',
      border: '1px solid rgba(128, 128, 128, 0.4)',
      borderRadius: 6,
      padding: '6px 8px',
      fontSize: 13,
      fontFamily: 'inherit',
      outline: 'none',
    }
    const LABEL_STYLE = {
      display: 'block',
      fontSize: 11,
      opacity: 0.75,
      marginBottom: 3,
    }

    function PresetList(props) {
      const { query, active, onPick, onActive, presets } = props
      const q = query.trim().toLowerCase()
      const filtered = presets.filter((p) => matchesPreset(p, q))
      if (filtered.length === 0) return null
      return h(
        'div',
        {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 2,
            background: 'var(--dsw-alias-bg-layer-1, #ffffff)',
            border: '1px solid rgba(128, 128, 128, 0.55)',
            borderRadius: 6,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.28)',
            maxHeight: 220,
            overflowY: 'auto',
          },
        },
        filtered.map((preset, index) =>
          h(
            'div',
            {
              key: preset.code,
              onMouseDown: (event) => event.preventDefault(),
              onClick: () => onPick(preset),
              onMouseEnter: () => onActive(index),
              style: {
                padding: '6px 8px',
                cursor: 'pointer',
                background: index === active ? 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.08))' : 'var(--dsw-alias-bg-layer-1, #ffffff)',
              },
            },
            h('span', { style: { fontWeight: 600, marginRight: 8 } }, `[${preset.code}]`),
            h('span', null, preset.text),
          ),
        ),
      )
    }

    function Box(props) {
      const { anchor, inputActions, onClose, useInput } = props
      const [query, setQuery] = React.useState('')
      const [comment, setComment] = React.useState('')
      const [active, setActive] = React.useState(0)
      const [open, setOpen] = React.useState(false)
      const [presets, setPresets] = React.useState(FALLBACK_PRESETS)
      const commentRef = React.useRef(null)
      const currentDraft = typeof useInput === 'function' ? useInput((state) => state.draft) : undefined

      // Fresh fetch per box open: editing presets.json applies immediately.
      React.useEffect(() => {
        let alive = true
        fetch('api/select-cite/presets', { credentials: 'same-origin' })
          .then((response) => response.json())
          .then((value) => {
            if (!alive) return
            if (value && value.ok === true && Array.isArray(value.presets) && value.presets.length > 0) {
              setPresets(value.presets)
            }
          })
          .catch(() => { /* fallback table stays */ })
        return () => {
          alive = false
        }
      }, [])

      const pickPreset = (preset) => {
        // The list shows text only; picking carries the detail along,
        // clippy-style: a short label plus the longer explanation.
        const detail =
          typeof preset.detail === 'string' && preset.detail.trim() !== ''
            ? `\n\n${preset.detail.trim()}`
            : ''
        setComment(`[${preset.code}] ${preset.text}${detail}`)
        setQuery('')
        setOpen(false)
        commentRef.current && commentRef.current.focus()
      }

      const submit = () => {
        const body = comment.trim()
        if (body === '') return
        const addition = buildDraft(anchor.quote, body, anchor)
        // Append after the existing draft instead of replacing it.
        const existing = typeof currentDraft === 'string' ? currentDraft.trim() : ''
        inputActions.setDraft(existing === '' ? addition : `${existing}\n\n${addition}`)
        if (typeof inputActions.focus === 'function') inputActions.focus()
        onClose()
      }

      const onSearchKeyDown = (event) => {
        const q = query.trim().toLowerCase()
        const filtered = presets.filter((p) => matchesPreset(p, q))
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          setActive((value) => (filtered.length === 0 ? 0 : Math.min(value + 1, filtered.length - 1)))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActive((value) => Math.max(value - 1, 0))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (filtered.length > 0) pickPreset(filtered[Math.min(active, filtered.length - 1)])
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }

      const onCommentKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          event.stopPropagation()
          submit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }

      const position = kit.positionOverlay(anchor, { width: 420 })

      return h(
        'div',
        {
          style: {
            ...BOX_STYLE,
            ...position,
          },
        },
        (locationText(anchor) !== ''
          ? h(
              'div',
              {
                style: {
                  fontSize: 11,
                  opacity: 0.8,
                  marginBottom: 6,
                },
              },
              `已定位：${locationText(anchor)}`,
            )
          : null),
        h('label', { style: LABEL_STYLE }, '预置评价（模糊搜索，↑↓ 选择，Enter 填入）'),
        h(
          'div',
          { style: { position: 'relative' } },
          h('input', {
            value: query,
            placeholder: '搜索 E-code…',
            style: INPUT_STYLE,
            onFocus: () => {
              setOpen(true)
              setActive(0)
            },
            onChange: (event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActive(0)
            },
            onKeyDown: onSearchKeyDown,
          }),
          open ? h(PresetList, { query, active, onPick: pickPreset, onActive: setActive, presets }) : null,
        ),
        h('label', { style: { ...LABEL_STYLE, marginTop: 8 } }, '意见（Enter 填入草稿，Shift+Enter 换行，Esc 关闭）'),
        h('textarea', {
          ref: commentRef,
          value: comment,
          rows: 3,
          placeholder: '写一条意见…',
          style: { ...INPUT_STYLE, resize: 'vertical' },
          onChange: (event) => setComment(event.target.value),
          onKeyDown: onCommentKeyDown,
        }),
        h(
          'div',
          { style: { display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' } },
          h(
            'button',
            {
              onClick: onClose,
              style: {
                border: '1px solid rgba(128,128,128,0.4)',
                background: 'transparent',
                color: 'inherit',
                borderRadius: 6,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
              },
            },
            '取消',
          ),
          h(
            'button',
            {
              onClick: submit,
              style: {
                border: 'none',
                background: 'var(--dsw-alias-primary, #1a6bff)',
                color: '#ffffff',
                borderRadius: 6,
                padding: '4px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
              },
            },
            '填入草稿',
          ),
        ),
      )
    }

    function Mount(props) {
      const { inputActions, useInput, anchorCtx } = props
      const boxRef = React.useRef(null)
      const [anchor, setAnchor] = kit.useAnchor(anchorCtx, boxRef)

      if (anchor === null || typeof inputActions !== 'object' || inputActions === null) return null
      const box = h(Box, { anchor, inputActions, useInput, onClose: () => setAnchor(null) })
      const body = typeof createPortal === 'function' ? createPortal(
        h('div', { ref: boxRef }, box),
        document.body,
      ) : h('div', { ref: boxRef }, box)
      return body
    }

    return {
      inject: ['slots'],
      apply: function (ctx) {
        kit.registerOverlay(ctx, {
          slot: 'conversation.input.overlay',
          id: 'select-cite',
          order: 80,
          component: Mount,
        })
      },
    }
  },
})
