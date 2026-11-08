/**
 * dsh-shutdown-screen — 浏览器半侧
 * ----------------------------------------------------------------------------
 * 注册两个东西：
 *   1) `settings.section` id=shutdown-screen  → 设置页「关闭动画」整页；
 *   2) `sidebar.footer.action` id=shutdown-exit → 侧栏底部「退出」电源按钮。
 *
 * 数据不走 settings 命名空间，走 Host 自带的 HTTP API：
 *   GET/POST /dsh-shutdown/config，GET /dsh-shutdown/media。
 * 注册 id 必须等于 loader entry 名（dsh-shutdown-screen），否则 ModuleLoader
 * 会报 "loaded without registering dsh-shutdown-screen"。
 */
window.__ModuleLoader__.load({
  id: 'dsh-shutdown-screen',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var ROUTE = '/dsh-shutdown'
    var API = ROUTE + '/config'
    var MEDIA_API = ROUTE + '/media'

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__sd_root{max-width:640px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__sd_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__sd_note{font-size:12px;line-height:1.7;color:var(--dsw-alias-label-tertiary);border-left:2px solid var(--dsw-alias-border-l2);padding-left:10px}',
      '.__sd_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__sd_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__sd_field{display:flex;flex-direction:column;gap:5px}',
      '.__sd_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__sd_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__sd_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__sd_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__sd_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__sd_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__sd_num{width:110px;flex:0 0 auto}',
      '.__sd_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:180px;max-width:100%}',
      '.__sd_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__sd_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__sd_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__sd_two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__sd_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__sd_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__sd_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__sd_btn:disabled{opacity:.5;cursor:default}',
      '.__sd_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__sd_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__sd_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__sd_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__sd_swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.__sd_videoNote{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
      '.__sd_videoNoteText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.55;word-break:break-all}',
      '.__sd_footBtn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;font:inherit}',
      '.__sd_footBtn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.__sd_footBtn:active{background:var(--dsw-alias-bg-layer-3)}',
      '.__sd_footBtnWide{width:auto;padding:0 10px;height:32px}',
      '.__sd_footLabel{font-size:12px;white-space:nowrap}',
    ].join('')
    var tagId = 'dsh-shutdown-screen/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-shutdown-screen'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__sd_field' },
        h('label', { className: '__sd_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__sd_hint' }, props.hint) : null
      )
    }
    function TextInput(props) {
      return h('input', {
        className: '__sd_input' + (props.mono ? ' __sd_inputMono' : '') + (props.narrow ? ' __sd_num' : ''),
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 80,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }
    function NumberInput(props) {
      return h('input', {
        className: '__sd_input __sd_num',
        type: 'number',
        min: props.min,
        max: props.max,
        step: props.step || 1,
        value: props.value == null ? '' : String(props.value),
        onChange: (e) => props.onChange(e.target.value === '' ? 0 : Number(e.target.value))
      })
    }
    function Select(props) {
      return h('select', {
        className: '__sd_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }
    function Check(props) {
      return h('label', { className: '__sd_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__sd_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__sd_hint' }, props.hint) : null
        )
      )
    }
    function ColorInput(props) {
      return h('input', {
        className: '__sd_swatch',
        type: 'color',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      })
    }
    function Range(props) {
      return h('div', { className: '__sd_row' },
        h('input', {
          type: 'range',
          min: props.min,
          max: props.max,
          step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 200px' },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__sd_status' }, props.display)
      )
    }
    function Button(props) {
      return h('button', {
        className: '__sd_btn' + (props.primary ? ' __sd_btnPrimary' : ''),
        type: 'button',
        disabled: !!props.disabled,
        onClick: props.onClick
      }, props.label)
    }

    /* ── 运行时兜底：万一 Host 的 index 注入没生效，按需加载 closing.js ──── */
    var runtimePromise = null
    function ensureRuntime(cb) {
      if (window.__DSH_SHUTDOWN_API__ && typeof window.__DSH_SHUTDOWN_API__.open === 'function') {
        cb(true)
        return
      }
      if (runtimePromise) { runtimePromise.then(cb); return }
      runtimePromise = new Promise(function (resolve) {
        try {
          if (!document.querySelector('link[data-dsh-shutdown-css]')) {
            var link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = ROUTE + '/closing.css'
            link.setAttribute('data-dsh-shutdown-css', '1')
            document.head.appendChild(link)
          }
          var script = document.createElement('script')
          script.src = ROUTE + '/closing.js?t=' + Date.now()
          script.async = false
          script.addEventListener('load', function () {
            var tries = 0
            ;(function wait() {
              if (window.__DSH_SHUTDOWN_API__ && typeof window.__DSH_SHUTDOWN_API__.open === 'function') { resolve(true); return }
              if (tries++ > 60) { resolve(false); return }
              setTimeout(wait, 60)
            })()
          })
          script.addEventListener('error', function () { resolve(false) })
          ;(document.head || document.documentElement).appendChild(script)
        } catch (e) {
          resolve(false)
        }
      })
      runtimePromise.then(cb)
    }

    function openShutdown(preview) {
      ensureRuntime(function (ok) {
        if (!ok) {
          try { window.alert('关闭动画运行时没有加载成功，请刷新页面后再试。') } catch (e) { /* 忽略 */ }
          return
        }
        try {
          if (preview && typeof window.__DSH_SHUTDOWN_API__.preview === 'function') window.__DSH_SHUTDOWN_API__.preview()
          else window.__DSH_SHUTDOWN_API__.open({ reason: 'client' })
        } catch (e) {
          try { window.alert('打开关闭动画失败：' + (e && e.message ? e.message : e)) } catch (e2) { /* 忽略 */ }
        }
      })
    }

    /* ── 语音：系统音色列表（zh 优先，其次 en） ─────────────────────────── */
    function readVoices() {
      try {
        var s = window.speechSynthesis
        if (!s) return []
        var list = (s.getVoices() || []).filter(function (v) { return v && v.name })
        return list.slice().sort(function (a, b) {
          function score(v) {
            var name = String(v.name || '').toLowerCase()
            var lang = String(v.lang || '').toLowerCase()
            var s = 0
            if (/natural|neural|online|premium|enhanced|xiaoxiao|xiaoyi|yunxi/.test(name)) s += 40
            if (lang.indexOf('zh') === 0) s += 20
            else if (lang.indexOf('en') === 0) s += 10
            if (/female|xiaoxiao|xiaoyi|晓晓|女声/.test(name)) s += 3
            return s
          }
          return score(b) - score(a)
        })
      } catch (e) {
        return []
      }
    }
    function speakTest(text) {
      try {
        var s = window.speechSynthesis
        if (!s) return
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(text || '会话已结束，感谢使用。')
        u.lang = 'zh-CN'
        u.rate = 0.9
        u.pitch = 0.9
        s.speak(u)
      } catch (e) { /* 忽略 */ }
    }
    function VoicePicker(props) {
      var [list, setList] = react.useState(readVoices)
      react.useEffect(function () {
        var s = window.speechSynthesis
        if (!s) return undefined
        var on = function () { setList(readVoices()) }
        try { s.addEventListener('voiceschanged', on) } catch (e) { /* 忽略 */ }
        var t = setTimeout(on, 400)
        return function () {
          try { s.removeEventListener('voiceschanged', on) } catch (e) { /* 忽略 */ }
          clearTimeout(t)
        }
      }, [])
      var opts = [['', '自动（优先中文 / 神经网络音色）']].concat(
        list.map(function (v) { return [v.name, v.name + ' · ' + (v.lang || '')] })
      )
      return h('div', { className: '__sd_field' },
        h('label', { className: '__sd_label' }, '音色'),
        h('div', { className: '__sd_row' },
          h(Select, { value: props.value || '', options: opts, onChange: props.onChange }),
          h(Button, { label: '试听', onClick: function () { speakTest() } })
        ),
        h('div', { className: '__sd_hint' },
          list.length ? '共 ' + list.length + ' 个系统音色；只有浏览器 TTS 可用。' : '暂时读不到系统音色（可能系统没装中文语音包）。')
      )
    }

    /* ── 字段渲染 ────────────────────────────────────────────────────────── */
    var FALLBACK = {
      enabled: true, mode: 'always', theme: 'dark', speed: 1,
      requireInteraction: true, allowSkip: true,
      sound: true, soundVolume: 0.7,
      voice: true, voiceLang: 'zh', voiceName: '', voiceRate: 0.88, voicePitch: 0.85,
      voiceVolume: 0.9, voiceCue: true, sfx: 'audio', voiceSource: 'tts', voiceLead: 240,
      identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
      brand1: 'DEEPSEEK', brand2: 'SYNTHESIZE INTELLIGENCE', brand3a: 'HARNESS', brand3b: 'OS',
      orgZh: '深度求索', orgEn: 'DEEPSEEK', orgSub: 'DEEPSEEK HARNESS',
      welcomeBox: 'SESSION CLOSED', footer: 'POWERED BY DEEPSEEK',
      accent: '#ff7500', glitchA: '#ff3b30', glitchB: '#2971b8',
      triggerButton: true, shortcut: 'Alt+Shift+Q', endAction: 'close',
      videoFile: 'closing.mp4', videoFit: 'contain', playFrom: 0, playTo: 0, showChrome: true,
    }
    var FALLBACK_VERSION = '0.1.0'
    function readInjectedVersion() {
      try { return window.__DSH_SHUTDOWN_VERSION__ ? String(window.__DSH_SHUTDOWN_VERSION__) : '' } catch (e) { return '' }
    }
    function bytesLabel(n) {
      if (!n || !isFinite(n)) return '0 B'
      if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
      if (n > 1024) return (n / 1024).toFixed(0) + ' KB'
      return n + ' B'
    }

    function renderField(f, draft, set, extra) {
      var value = draft[f.key]
      var hint = f.hint
      if (f.kind === 'bool') {
        return h(Check, { label: f.label, hint: hint, checked: !!value, onChange: (v) => set(f.key, v) })
      }
      var control
      if (f.kind === 'select') {
        control = h(Select, { value: value, options: f.options, onChange: (v) => set(f.key, v) })
      } else if (f.kind === 'text') {
        control = h(TextInput, { value: value, mono: !!f.mono, maxLength: f.maxLength || 80, onChange: (v) => set(f.key, v) })
      } else if (f.kind === 'number') {
        control = h('div', { className: '__sd_row' },
          h(NumberInput, { value: value, min: f.min, max: f.max, step: f.step, onChange: (v) => set(f.key, v) }),
          f.suffix ? h('span', { className: '__sd_status' }, f.suffix) : null
        )
      } else if (f.kind === 'range') {
        control = h(Range, { value: value, min: f.min, max: f.max, step: f.step, display: f.display ? f.display(value) : String(value), onChange: (v) => set(f.key, v) })
      } else if (f.kind === 'color') {
        control = h('div', { className: '__sd_row' }, h(ColorInput, { value: value, onChange: (v) => set(f.key, v) }), h('span', { className: '__sd_status' }, String(value)))
      } else if (f.kind === 'voice') {
        return h(VoicePicker, { value: value, onChange: (v) => set(f.key, v) })
      } else {
        control = h(TextInput, { value: value, onChange: (v) => set(f.key, v) })
      }
      return h(Field, { label: f.label, hint: hint }, control)
    }

    function group(title, children) {
      var items = children.filter(Boolean)
      return h('div', { className: '__sd_group' },
        h('div', { className: '__sd_groupTitle' }, title),
        items
      )
    }

    /* ── 设置页：关闭动画 ────────────────────────────────────────────────── */
    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [defaults, setDefaults] = react.useState(null)
      var [files, setFiles] = react.useState([])
      var [mediaDir, setMediaDir] = react.useState('')
      var [video, setVideo] = react.useState(null)
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setDefaults(Object.assign({}, FALLBACK, j.defaults))
            setFiles(Array.isArray(j.files) ? j.files : [])
            setMediaDir(j.mediaDir || '')
            setVideo(j.video || null)
            if (j.version) setVersion(String(j.version))
          })
          .catch((e) => setError('读取配置失败：' + String(e && e.message ? e.message : e)))
      }
      react.useEffect(function () { load() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft(function (d) { var next = Object.assign({}, d); next[key] = value; return next })
      }
      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            if (j.video) setVideo(j.video)
            if (Array.isArray(j.files)) setFiles(j.files)
            setNotice('已保存。关闭动画与快捷键立刻使用新配置（已经在播放的动画不受影响）。')
          })
          .catch((e) => setError('保存失败：' + String(e && e.message ? e.message : e)))
          .then(function () { setBusy(false) })
      }
      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            if (j.video) setVideo(j.video)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + String(e && e.message ? e.message : e)))
          .then(function () { setBusy(false) })
      }
      function refreshMedia() {
        fetch(MEDIA_API, { cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'media failed')
            setFiles(Array.isArray(j.files) ? j.files : [])
            setNotice('已刷新媒体目录：' + (j.mediaDir || mediaDir))
          })
          .catch((e) => setError('刷新失败：' + String(e && e.message ? e.message : e)))
      }
      function copyDir() {
        var text = mediaDir || '~/.dsh/dsh-shutdown/'
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { setNotice('已复制媒体目录路径。') }, function () { setNotice(text) })
            return
          }
        } catch (e) { /* 退回展示 */ }
        setNotice(text)
      }

      var versionLine = h('div', { className: '__sd_version' }, '版本 v' + (version || FALLBACK_VERSION) + ' · 与「启动动画」可共存')

      if (!draft) {
        return h('div', { className: '__sd_root' },
          versionLine,
          h('div', { className: '__sd_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__sd_actions' }, h(Button, { label: '重试', onClick: load })) : null
        )
      }

      var modeOptions = [
        ['always', '每次退出都播放'],
        ['session', '每个浏览器会话一次'],
        ['daily', '每天一次'],
      ]
      var warn = '视频由本机 DSH Web 服务提供，不会上传到任何服务器。'
      var videoExists = video && video.exists
      var statusText = video
        ? (videoExists
          ? '当前视频：' + video.name + ' · ' + bytesLabel(video.size) + ' · 已就绪'
          : '当前视频：' + video.name + ' · 尚未放入媒体目录')
        : '尚未读取到视频状态'
      var fileOptions = [['', '（未选择）']].concat(files.map(function (f) {
        return [f.name, f.name + ' · ' + bytesLabel(f.size)]
      }))
      if (draft.videoFile && !files.some(function (f) { return f.name === draft.videoFile })) {
        fileOptions.push([draft.videoFile, draft.videoFile + '（缺失）'])
      }
      var actionOptions = [
        ['close', '播放完后尝试关闭标签页（推荐）'],
        ['card', '播放完后停留在结束页'],
        ['reload', '播放完后重新进入 DSH'],
      ]

      return h('div', { className: '__sd_root' },
        versionLine,
        h('div', { className: '__sd_note' },
          '「关闭动画」在退出时全屏播放你指定的视频；与「启动动画」是两个独立设置页，可同时启用。'
          + '浏览器安全策略不允许网页拦截标签页右上角的 ×，所以退出入口是：侧栏底部的电源按钮，或快捷键 '
          + (draft.shortcut || 'Alt+Shift+Q') + '。'
        ),

        group('播放', [
          h(Check, {
            label: '启用关闭动画',
            hint: '关闭后点退出按钮会直接尝试关页，不再播放视频。',
            checked: draft.enabled,
            onChange: function (v) { set('enabled', v) }
          }),
          h(Field, { label: '播放时机' },
            h(Select, { value: draft.mode, options: modeOptions, onChange: function (v) { set('mode', v) } })
          ),
          h(Field, { label: '视频倍速', hint: '1 = 原速；只影响这段视频的播放速度。' },
            h(Range, {
              value: draft.speed, min: 0.35, max: 3, step: 0.05,
              display: Number(draft.speed).toFixed(2) + '×',
              onChange: function (v) { set('speed', v) }
            })
          ),
        ]),

        group('视频', [
          h(Field, {
            label: '视频文件',
            hint: '把 mp4 / webm / m4v 放进媒体目录，点「刷新列表」后即可选择。默认文件名 closing.mp4。'
          },
            h('div', { className: '__sd_row' },
              h(Select, { value: draft.videoFile, options: fileOptions, onChange: function (v) { set('videoFile', v) } }),
              h(Button, { label: '刷新列表', onClick: refreshMedia })
            )
          ),
          h(Field, { label: '画面适配' },
            h(Select, {
              value: draft.videoFit,
              options: [['contain', '完整显示（留黑边）'], ['cover', '铺满裁切']],
              onChange: function (v) { set('videoFit', v) }
            })
          ),
          h('div', { className: '__sd_two' },
            h(Field, { label: '从第几秒开始', hint: '0 = 从头播。' },
              h(NumberInput, { value: draft.playFrom, min: 0, max: 36000, step: 0.1, onChange: function (v) { set('playFrom', v) } })
            ),
            h(Field, { label: '播到第几秒', hint: '0 = 一直播到视频结尾。' },
              h(NumberInput, { value: draft.playTo, min: 0, max: 36000, step: 0.1, onChange: function (v) { set('playTo', v) } })
            )
          ),
          h('div', { className: '__sd_videoNote' },
            h('div', { className: '__sd_videoNoteText' }, '媒体目录：' + (mediaDir || '~/.dsh/dsh-shutdown/')),
            h('div', { className: '__sd_videoNoteText' }, statusText),
            h('div', { className: '__sd_row' },
              h(Button, { label: '复制媒体目录', onClick: copyDir }),
              h(Button, { label: '立即预览', onClick: function () { openShutdown(true) } })
            ),
            h('div', { className: '__sd_hint' }, warn)
          ),
        ]),

        group('触发与结束', [
          h(Check, {
            label: '在侧栏底部显示「退出」按钮',
            hint: '按钮位于设置入口旁边。关掉后仍可用快捷键退出。',
            checked: draft.triggerButton,
            onChange: function (v) { set('triggerButton', v) }
          }),
          h(Field, {
            label: '退出快捷键',
            hint: '格式如 Alt+Shift+Q、Ctrl+Shift+E；纯按键（如单独的 Q）不安全，不会被保存。在输入框里打字时不会触发。'
          },
            h(TextInput, { value: draft.shortcut, mono: true, maxLength: 32, onChange: function (v) { set('shortcut', v) } })
          ),
          h(Field, {
            label: '播放结束后',
            hint: '「尝试关闭标签页」受浏览器限制：只有脚本打开的窗口才能被自动关闭，普通标签页会停在结束页并提示 Ctrl+W。'
          },
            h(Select, { value: draft.endAction, options: actionOptions, onChange: function (v) { set('endAction', v) } })
          ),
        ]),

        group('交互', [
          h(Check, { label: '退出前二次确认', hint: '弹一个原生确认框，避免误触。', checked: draft.requireInteraction, onChange: function (v) { set('requireInteraction', v) } }),
          h(Check, { label: '允许跳过视频', hint: '显示 SKIP 按钮；按 Esc 也可跳过。', checked: draft.allowSkip, onChange: function (v) { set('allowSkip', v) } }),
        ]),

        group('声音 / 语音 / 音效', [
          h(Check, { label: '播放视频声音', checked: draft.sound, onChange: function (v) { set('sound', v) } }),
          h(Field, { label: '视频音量' },
            h(Range, {
              value: draft.soundVolume, min: 0, max: 1, step: 0.01,
              display: Math.round(Number(draft.soundVolume) * 100) + '%',
              onChange: function (v) { set('soundVolume', v) }
            })
          ),
          h(Check, { label: '结束语 TTS', hint: '视频播完后用系统语音说一句告别语。', checked: draft.voice, onChange: function (v) { set('voice', v) } }),
          h(Field, { label: '告别语语言' },
            h(Select, {
              value: draft.voiceLang,
              options: [['zh', '中文'], ['en', 'English'], ['both', '中英各一遍']],
              onChange: function (v) { set('voiceLang', v) }
            })
          ),
          renderField({ kind: 'voice', key: 'voiceName', label: '音色' }, draft, set),
          h(Field, { label: '语速' },
            h(Range, { value: draft.voiceRate, min: 0.5, max: 2, step: 0.02, display: Number(draft.voiceRate).toFixed(2), onChange: function (v) { set('voiceRate', v) } })
          ),
          h(Field, { label: '音高' },
            h(Range, { value: draft.voicePitch, min: 0, max: 2, step: 0.02, display: Number(draft.voicePitch).toFixed(2), onChange: function (v) { set('voicePitch', v) } })
          ),
          h(Field, { label: '语音音量' },
            h(Range, { value: draft.voiceVolume, min: 0, max: 1, step: 0.01, display: Math.round(Number(draft.voiceVolume) * 100) + '%', onChange: function (v) { set('voiceVolume', v) } })
          ),
          h(Check, { label: 'TTS 前提示音', checked: draft.voiceCue, onChange: function (v) { set('voiceCue', v) } }),
          h(Field, { label: '结尾音效', hint: 'audio = 不额外加音效（用视频原声结尾）；synth = 合成器关机音。' },
            h(Select, {
              value: draft.sfx,
              options: [['audio', '沿用视频原声'], ['synth', '合成器关机音']],
              onChange: function (v) { set('sfx', v) }
            })
          ),
          h(Field, { label: 'TTS 延后毫秒', hint: '结束卡片出现后延迟多久开始播报。' },
            h(NumberInput, { value: draft.voiceLead, min: 0, max: 5000, step: 20, onChange: function (v) { set('voiceLead', v) } })
          ),
        ]),

        group('视觉', [
          h(Field, { label: '主题' },
            h(Select, {
              value: draft.theme,
              options: [['dark', '深色'], ['light', '浅色']],
              onChange: function (v) { set('theme', v) }
            })
          ),
          h(Check, { label: '显示角标与进度条', hint: '视频上方的品牌、ID、SKIP、进度条。', checked: draft.showChrome, onChange: function (v) { set('showChrome', v) } }),
          h('div', { className: '__sd_two' },
            h(Field, { label: '强调色' }, h(ColorInput, { value: draft.accent, onChange: function (v) { set('accent', v) } })),
            h(Field, { label: '故障色 A' }, h(ColorInput, { value: draft.glitchA, onChange: function (v) { set('glitchA', v) } }))
          ),
          h(Field, { label: '故障色 B' }, h(ColorInput, { value: draft.glitchB, onChange: function (v) { set('glitchB', v) } })),
        ]),

        group('身份资料', [
          h(Field, { label: '身份名称' }, h(TextInput, { value: draft.identity, maxLength: 40, onChange: function (v) { set('identity', v) } })),
          h(Field, { label: '身份编号' }, h(TextInput, { value: draft.identityId, mono: true, maxLength: 16, onChange: function (v) { set('identityId', v) } })),
          h(Field, { label: '权限等级' }, h(TextInput, { value: draft.accessLevel, mono: true, maxLength: 8, onChange: function (v) { set('accessLevel', v) } })),
        ]),

        group('品牌与文案', [
          h('div', { className: '__sd_two' },
            h(Field, { label: '品牌第 1 行' }, h(TextInput, { value: draft.brand1, onChange: function (v) { set('brand1', v) } })),
            h(Field, { label: '品牌第 2 行' }, h(TextInput, { value: draft.brand2, onChange: function (v) { set('brand2', v) } }))
          ),
          h('div', { className: '__sd_two' },
            h(Field, { label: '品牌第 3 行（左）' }, h(TextInput, { value: draft.brand3a, onChange: function (v) { set('brand3a', v) } })),
            h(Field, { label: '品牌第 3 行（右）' }, h(TextInput, { value: draft.brand3b, onChange: function (v) { set('brand3b', v) } }))
          ),
          h('div', { className: '__sd_two' },
            h(Field, { label: '机构名（中）' }, h(TextInput, { value: draft.orgZh, onChange: function (v) { set('orgZh', v) } })),
            h(Field, { label: '机构名（英）' }, h(TextInput, { value: draft.orgEn, onChange: function (v) { set('orgEn', v) } }))
          ),
          h(Field, { label: '副标题' }, h(TextInput, { value: draft.orgSub, onChange: function (v) { set('orgSub', v) } })),
          h('div', { className: '__sd_two' },
            h(Field, { label: '结束框文案' }, h(TextInput, { value: draft.welcomeBox, onChange: function (v) { set('welcomeBox', v) } })),
            h(Field, { label: '页脚' }, h(TextInput, { value: draft.footer, onChange: function (v) { set('footer', v) } }))
          ),
        ]),

        h('div', { className: '__sd_actions' },
          h(Button, { label: busy ? '保存中…' : '保存', primary: true, disabled: busy, onClick: save }),
          h(Button, { label: '立即预览', disabled: busy, onClick: function () { openShutdown(true) } }),
          h(Button, { label: '恢复默认', disabled: busy, onClick: reset }),
          h(Button, { label: '放弃修改', disabled: busy, onClick: load })
        ),
        notice ? h('div', { className: '__sd_ok' }, notice) : null,
        error ? h('div', { className: '__sd_err' }, error) : null
      )
    }

    /* ── 侧栏底部「退出」按钮 ───────────────────────────────────────────── */
    function PowerIcon(props) {
      var size = (props && props.size) || 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true'
      },
        h('path', { d: 'M12 3v9' }),
        h('path', { d: 'M6.3 6.3a8 8 0 1 0 11.4 0' })
      )
    }
    function FooterExitButton(props) {
      var [visible, setVisible] = react.useState(true)
      react.useEffect(function () {
        fetch(API, { cache: 'no-store' })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (j && j.ok === true && j.config && j.config.triggerButton === false) setVisible(false)
          })
          .catch(function () { /* 读取失败就默认显示 */ })
      }, [])
      if (!visible) return null
      var wide = !!(props && props.wide)
      return h('button', {
        className: '__sd_footBtn' + (wide ? ' __sd_footBtnWide' : ''),
        type: 'button',
        title: '退出（播放关闭动画）',
        'aria-label': '退出并播放关闭动画',
        onClick: function () { openShutdown(false) }
      },
        h(PowerIcon, { size: 16 }),
        wide ? h('span', { className: '__sd_footLabel' }, '退出') : null
      )
    }

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'shutdown-screen', order: 27, label: '关闭动画' },
          function () { return h(Panel, {}) }
        )
      })
      try {
        ctx.slots.inject('settings.section.icon', function () {
          return ctx.slots.register(
            { name: 'settings.section.icon', id: 'shutdown-screen', order: 27, label: '关闭动画' },
            function (props) { return h(PowerIcon, { size: (props && props.size) || 16 }) }
          )
        })
      } catch (e) { /* 旧版设置页没有 icon 插槽时忽略 */ }
      try {
        ctx.slots.inject('sidebar.footer.action', function () {
          return ctx.slots.register(
            { name: 'sidebar.footer.action', id: 'shutdown-exit', order: 55, label: '退出' },
            FooterExitButton
          )
        })
      } catch (e) {
        try { console.warn('[dsh-shutdown-screen] 侧栏按钮注册失败：', e && e.message ? e.message : e) } catch (e2) { /* 忽略 */ }
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
