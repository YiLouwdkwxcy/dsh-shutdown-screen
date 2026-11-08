/* ============================================================================
 * dsh-shutdown-screen —— 关闭动画运行时（浏览器半侧，由 Host 注入 index.html）
 *
 * 流程：触发（侧栏按钮 / 快捷键 / 事件 / 设置页预览）
 *   → 读取最新配置（GET /dsh-shutdown/config）
 *   → 全屏 overlay 直接播放视频（支持从 playFrom 播到 playTo）
 *   → 结束后展示结束卡片（品牌 / 身份 / TTS 告别 / 合成音效）
 *   → 按 endAction 尝试关闭标签页；浏览器拒绝时提示 Ctrl+W 并保留「返回页面」。
 *
 * 与 dsh-startup-screen 的协调：
 *   - 启动动画播放期间（__DSH_STARTUP_RUNNING__ 或 #dsh-startup-root 存在）不触发。
 *   - z-index 2147483600 高于启动动画根节点 2147483000。
 *   - 本文件不依赖启动插件的任何私有 API，只读它公开的 window 标志。
 * ========================================================================== */
(function () {
  'use strict'
  if (window.__DSH_SHUTDOWN_LOADED__) return
  window.__DSH_SHUTDOWN_LOADED__ = true

  var ROUTE = window.__DSH_SHUTDOWN_ROUTE__ || '/dsh-shutdown'
  var INJECTED = window.__DSH_SHUTDOWN__ || {}
  var Z_INDEX = 2147483600
  var SESSION_KEY = 'dsh-shutdown:played'
  var DAILY_KEY = 'dsh-shutdown:daily'

  /* 只在 Host 注入完全失效时兜底的少量默认值；正常路径下一次 GET /config 会覆盖。 */
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
  function cfgOrDefaults(raw) {
    var out = {}
    for (var k in FALLBACK) out[k] = k in (raw || {}) ? raw[k] : FALLBACK[k]
    return out
  }

  var state = {
    cfg: cfgOrDefaults(INJECTED),
    remote: null,
    root: null,
    video: null,
    nodes: null,
    mode: 'idle', // idle | video | ending | done
    preview: false,
    endOnly: false,
    timers: [],
    listeners: [],
    audio: null,
    lastFocus: null,
    videoError: null,
  }

  /* ------------------------------------------------------------------ 工具 */
  function later(fn, ms) {
    var t = setTimeout(function () {
      state.timers = state.timers.filter(function (x) { return x !== t })
      fn()
    }, ms)
    state.timers.push(t)
    return t
  }
  function clearTimers() {
    state.timers.forEach(function (t) { clearTimeout(t) })
    state.timers = []
  }
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts || false)
    state.listeners.push([target, type, fn, opts || false])
  }
  function gOn(target, type, fn, opts) {
    /* 全局监听：overlay 关闭时不清理，保证快捷键可以反复触发 */
    target.addEventListener(type, fn, opts || false)
  }
  function offAll() {
    state.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]) })
    state.listeners = []
  }
  function $(root, sel) { return root.querySelector(sel) }
  function txt(node, value) { if (node) node.textContent = value == null ? '' : String(value) }
  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }
  function isTypingTarget(t) {
    if (!t || !t.tagName) return false
    var tag = t.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (t.isContentEditable) return true
    return false
  }
  function dayKey() {
    var d = new Date()
    var m = String(d.getMonth() + 1)
    var day = String(d.getDate())
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day)
  }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0
    var s = Math.floor(sec % 60)
    var m = Math.floor(sec / 60)
    return m + ':' + (s < 10 ? '0' + s : s)
  }
  function safeGet(store, key) { try { return store.getItem(key) } catch (e) { return null } }
  function safeSet(store, key, value) { try { store.setItem(key, value) } catch (e) { /* 隐私模式忽略 */ } }

  /* ------------------------------------------------------------------ 配置 */
  function loadConfig() {
    return fetch(ROUTE + '/config', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null })
      .then(function (data) {
        if (data && data.ok && data.config) {
          state.remote = data
          state.cfg = cfgOrDefaults(data.config)
          if (data.video) state.videoInfo = data.video
        }
        return state.cfg
      })
      .catch(function () { return state.cfg })
  }
  function shouldSkip(cfg) {
    if (!cfg.enabled) return true
    if (cfg.mode === 'session' && safeGet(sessionStorage, SESSION_KEY) === '1') return true
    if (cfg.mode === 'daily' && safeGet(localStorage, DAILY_KEY) === dayKey()) return true
    return false
  }
  function markPlayed(cfg) {
    if (cfg.mode === 'session') safeSet(sessionStorage, SESSION_KEY, '1')
    if (cfg.mode === 'daily') safeSet(localStorage, DAILY_KEY, dayKey())
  }
  function startupBusy() {
    if (window.__DSH_STARTUP_RUNNING__ === true) return true
    var root = document.getElementById('dsh-startup-root')
    if (root && !root.hidden && root.getClientRects().length) {
      if (window.__DSH_STARTUP_FINISHED__ === true) return false
      return true
    }
    return false
  }

  /* ------------------------------------------------------------------ 音频 */
  function audioContext() {
    var AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    try {
      if (!state.audio) state.audio = new AC()
      if (state.audio.state === 'suspended') state.audio.resume().catch(function () {})
      return state.audio
    } catch (e) {
      return null
    }
  }
  function tone(freq, startDelay, duration, type, gainValue) {
    var ac = audioContext()
    if (!ac) return
    try {
      var t0 = ac.currentTime + startDelay
      var osc = ac.createOscillator()
      var gain = ac.createGain()
      osc.type = type || 'sine'
      osc.frequency.setValueAtTime(freq, t0)
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue == null ? 0.08 : gainValue), t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t0)
      osc.stop(t0 + duration + 0.05)
    } catch (e) {
      /* 音频不可用时静默 */
    }
  }
  function cueBeep(cfg) {
    var v = cfg.voiceVolume == null ? 0.9 : cfg.voiceVolume
    tone(880, 0, 0.09, 'sine', 0.05 * v)
    tone(1320, 0.1, 0.12, 'sine', 0.04 * v)
  }
  function powerDownSound(cfg) {
    if (cfg.sfx !== 'synth') return
    tone(392, 0, 0.32, 'triangle', 0.07)
    tone(261.63, 0.12, 0.5, 'sine', 0.06)
    tone(130.81, 0.3, 0.85, 'sine', 0.05)
  }
  function speak(text, cfg) {
    if (!cfg.voice || !text) return
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return
    try {
      window.speechSynthesis.cancel()
      var u = new window.SpeechSynthesisUtterance(text)
      var lang = cfg.voiceLang === 'en' ? 'en-US' : 'zh-CN'
      u.lang = lang
      u.rate = cfg.voiceRate
      u.pitch = cfg.voicePitch
      u.volume = cfg.voiceVolume
      if (cfg.voiceName) {
        var voices = window.speechSynthesis.getVoices() || []
        for (var i = 0; i < voices.length; i++) {
          if (voices[i] && voices[i].name === cfg.voiceName) { u.voice = voices[i]; break }
        }
      }
      if (cfg.voiceCue) cueBeep(cfg)
      window.speechSynthesis.speak(u)
    } catch (e) {
      /* TTS 不可用时静默 */
    }
  }
  function outroText(cfg) {
    var name = cfg.orgZh || cfg.orgEn || 'DeepSeek Harness'
    if (cfg.voiceLang === 'en') return 'Session closed. Thank you for using DeepSeek Harness.'
    if (cfg.voiceLang === 'both') return '会话已结束。' + name + '，感谢使用。 Session closed. Thank you for using DeepSeek Harness.'
    return '会话已结束。' + name + '，感谢使用。'
  }

  /* ------------------------------------------------------------------ DOM */
  var TEMPLATE = [
    '<div class="dsu2-stage">',
    '  <video class="dsu2-video" playsinline preload="auto" disablepictureinpicture disableremoteplayback></video>',
    '  <div class="dsu2-vignette"></div>',
    '  <div class="dsu2-scan"></div>',
    '  <div class="dsu2-chrome">',
    '    <div class="dsu2-top">',
    '      <div class="dsu2-brand"><div class="dsu2-brand1"></div><div class="dsu2-brand2"></div><div class="dsu2-brand3"></div></div>',
    '    </div>',
    '    <div class="dsu2-bottom">',
    '      <div class="dsu2-bottomCol">',
    '        <div class="dsu2-status"></div>',
    '        <div class="dsu2-copy"></div>',
    '      </div>',
    '      <div class="dsu2-bottomCol dsu2-right">',
    '        <div class="dsu2-id"></div>',
    '        <div class="dsu2-foot"></div>',
    '      </div>',
    '    </div>',
    '    <div class="dsu2-bar"><i></i></div>',
    '  </div>',
    '  <button type="button" class="dsu2-skip" hidden>SKIP ▸</button>',
    '  <div class="dsu2-end" hidden>',
    '    <div class="dsu2-endInner">',
    '      <div class="dsu2-orgZh"></div><div class="dsu2-orgEn"></div><div class="dsu2-box"></div><div class="dsu2-orgSub"></div>',
    '    </div>',
    '    <div class="dsu2-endFoot"><div class="dsu2-identity"></div><div class="dsu2-foot"></div></div>',
    '    <div class="dsu2-hint" hidden><p class="dsu2-hintText"></p><p class="dsu2-hintText dsu2-hintKey"></p><div class="dsu2-hintBtns"></div></div>',
    '    <div class="dsu2-previewTag" hidden>预览模式</div>',
    '  </div>',
    '  <div class="dsu2-veil" hidden><div class="dsu2-veilBtn">点击开始播放</div></div>',
    '</div>',
  ].join('')

  function mount(cfg, opts) {
    state.preview = !!(opts && opts.preview)
    state.endOnly = !!(opts && opts.endOnly)
    state.videoError = null
    state.mode = 'video'
    state.lastFocus = document.activeElement

    var root = document.createElement('div')
    root.id = 'dsh-shutdown-root'
    root.className = 'dsu2-root'
    root.setAttribute('data-theme', cfg.theme === 'light' ? 'light' : 'dark')
    root.setAttribute('data-fit', cfg.videoFit === 'cover' ? 'cover' : 'contain')
    root.style.setProperty('--accent', cfg.accent || '#ff7500')
    root.style.setProperty('--glitch-a', cfg.glitchA || '#ff3b30')
    root.style.setProperty('--glitch-b', cfg.glitchB || '#2971b8')
    root.style.zIndex = String(Z_INDEX)
    root.innerHTML = TEMPLATE

    var nodes = {
      video: $(root, '.dsu2-video'),
      chrome: $(root, '.dsu2-chrome'),
      brand1: $(root, '.dsu2-brand1'),
      brand2: $(root, '.dsu2-brand2'),
      brand3: $(root, '.dsu2-brand3'),
      id: $(root, '.dsu2-id'),
      status: $(root, '.dsu2-status'),
      copy: $(root, '.dsu2-copy'),
      foot: $(root, '.dsu2-foot'),
      bar: $(root, '.dsu2-bar i'),
      skip: $(root, '.dsu2-skip'),
      end: $(root, '.dsu2-end'),
      orgZh: $(root, '.dsu2-orgZh'),
      orgEn: $(root, '.dsu2-orgEn'),
      box: $(root, '.dsu2-box'),
      orgSub: $(root, '.dsu2-orgSub'),
      identity: $(root, '.dsu2-identity'),
      endFoot: $(root, '.dsu2-endFoot .dsu2-foot'),
      hint: $(root, '.dsu2-hint'),
      hintText: $(root, '.dsu2-hintText'),
      hintKey: $(root, '.dsu2-hint .dsu2-hintKey'),
      hintBtns: $(root, '.dsu2-hintBtns'),
      previewTag: $(root, '.dsu2-previewTag'),
      veil: $(root, '.dsu2-veil'),
      veilBtn: $(root, '.dsu2-veilBtn'),
    }
    state.root = root
    state.nodes = nodes
    state.video = nodes.video

    /* 文案 */
    txt(nodes.brand1, cfg.brand1)
    txt(nodes.brand2, cfg.brand2)
    nodes.brand3.textContent = cfg.brand3a + ' '
    var bSpan = document.createElement('b')
    bSpan.textContent = cfg.brand3b
    nodes.brand3.appendChild(bSpan)
    nodes.id.textContent = 'ID CONFIRMED : '
    var idB = document.createElement('b')
    idB.textContent = cfg.identityId
    nodes.id.appendChild(idB)
    txt(nodes.copy, cfg.welcomeBox)
    txt(nodes.foot, cfg.footer)
    txt(nodes.identity, cfg.identity || '')
    txt(nodes.endFoot, cfg.footer)
    txt(nodes.orgZh, cfg.orgZh)
    txt(nodes.orgEn, cfg.orgEn)
    txt(nodes.box, cfg.welcomeBox)
    txt(nodes.orgSub, cfg.orgSub)
    txt(nodes.status, '[ SHUTDOWN ] 正在结束会话')

    if (!cfg.showChrome) root.classList.add('dsu2-nochrome')
    if (cfg.allowSkip && !state.endOnly) {
      nodes.skip.hidden = false
      later(function () { if (state.root === root) root.classList.add('dsu2-skipReady') }, 700)
    }
    if (state.preview) nodes.previewTag.hidden = false

    /* 锁定页面滚动 */
    document.documentElement.classList.add('dsu2-lock')
    document.body.appendChild(root)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (state.root === root) root.classList.add('dsu2-visible') })
    })

    /* 交互 */
    on(nodes.skip, 'click', function () { endNow('skip') })
    on(nodes.veil, 'click', function () {
      nodes.veil.hidden = true
      tryPlay(cfg)
    })

    if (window.__DSH_SHUTDOWN_RUNNING__ !== undefined) window.__DSH_SHUTDOWN_RUNNING__ = true

    if (state.endOnly) {
      later(function () { beginEnding(cfg) }, 120)
      return
    }
    startVideo(cfg)
  }

  function startVideo(cfg) {
    var video = state.video
    if (!video) return
    var info = state.videoInfo
    var src = ROUTE + '/video' + (info && info.mtime ? '?v=' + Math.round(info.mtime) : '')
    video.volume = cfg.sound ? Math.max(0, Math.min(1, cfg.soundVolume)) : 0
    video.muted = !cfg.sound
    video.playbackRate = Math.max(0.35, Math.min(3, cfg.speed || 1))

    var started = false
    var onMeta = function () {
      try {
        var from = Math.max(0, Number(cfg.playFrom) || 0)
        if (isFinite(video.duration) && from > 0.05 && from < video.duration - 0.05) video.currentTime = from
      } catch (e) { /* 忽略 */ }
      updateStatus(cfg)
    }
    on(video, 'loadedmetadata', onMeta)
    on(video, 'durationchange', onMeta)
    on(video, 'timeupdate', function () {
      updateProgress(cfg)
      guardPlayTo(cfg)
      updateStatus(cfg)
    })
    on(video, 'error', function () { showVideoError(cfg) })
    on(video, 'ended', function () { beginEnding(cfg) })
    on(video, 'playing', function () {
      started = true
      var veil = state.nodes && state.nodes.veil
      if (veil) veil.hidden = true
    })
    video.src = src
    tryPlay(cfg)
    later(function () {
      if (state.mode !== 'video' || state.endOnly) return
      if (started) return
      var veil = state.nodes && state.nodes.veil
      if (veil) veil.hidden = false
    }, 1600)
    later(function () {
      if (!started && state.mode === 'video') updateStatus(cfg, '首次播放被浏览器拦截，点击画面继续')
    }, 1800)
  }

  function tryPlay(cfg) {
    var video = state.video
    if (!video) return
    var promise = null
    try { promise = video.play() } catch (e) { promise = null }
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        var veil = state.nodes && state.nodes.veil
        if (veil) veil.hidden = false
      })
    }
  }

  function effectiveRange(cfg) {
    var video = state.video
    var dur = video && isFinite(video.duration) ? video.duration : 0
    var from = Math.max(0, Number(cfg.playFrom) || 0)
    var to = Number(cfg.playTo) || 0
    if (to > 0 && to > from) return { from: from, to: to }
    return { from: from, to: dur }
  }

  function updateProgress(cfg) {
    if (!state.nodes) return
    var range = effectiveRange(cfg)
    var total = range.to - range.from
    if (!(total > 0)) return
    var cur = (state.video ? state.video.currentTime : 0) - range.from
    var pct = Math.max(0, Math.min(100, (cur / total) * 100))
    state.nodes.bar.style.width = pct.toFixed(2) + '%'
  }

  function guardPlayTo(cfg) {
    var to = Number(cfg.playTo) || 0
    if (to > 0 && state.video && state.video.currentTime >= to) endNow('playTo')
  }

  function updateStatus(cfg, extra) {
    if (!state.nodes) return
    var range = effectiveRange(cfg)
    var time = formatTime(state.video ? state.video.currentTime : 0)
    var total = range.to > 0 ? formatTime(range.to) : '--:--'
    txt(state.nodes.status, '[ SHUTDOWN ] ' + (extra || '正在播放关闭动画') + ' · ' + time + ' / ' + total)
  }

  function showVideoError(cfg) {
    if (state.mode !== 'video') return
    state.videoError = true
    if (!state.nodes) return
    txt(state.nodes.status, '[ SHUTDOWN ] 视频加载失败')
    var box = state.nodes.box
    txt(state.nodes.orgZh, '视频不可用')
    txt(state.nodes.orgEn, 'VIDEO UNAVAILABLE')
    txt(box, '~/.dsh/dsh-shutdown/')
    txt(state.nodes.orgSub, '把视频放进该目录（默认 closing.mp4），或在设置页选择其它文件')
    beginEnding(cfg, true)
  }

  /* ------------------------------------------------------------------ 结束 */
  function beginEnding(cfg, fromError) {
    if (state.mode === 'ending' || state.mode === 'done') return
    state.mode = 'ending'
    var nodes = state.nodes
    if (!nodes) return
    if (!fromError && !state.preview) markPlayed(cfg)
    var video = state.video
    if (video) {
      video.classList.add('dsu2-fading')
      later(function () {
        try { video.pause() } catch (e) { /* 忽略 */ }
      }, 480)
    }
    if (nodes.chrome) nodes.chrome.classList.add('dsu2-hidden')
    if (nodes.skip) nodes.skip.hidden = true

    if (!fromError) {
      powerDownSound(cfg)
      nodes.end.classList.add('dsu2-glitch')
      later(function () { if (state.nodes) state.nodes.end.classList.remove('dsu2-glitch') }, 900)
    }
    nodes.end.hidden = false
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (state.nodes) state.nodes.end.classList.add('dsu2-show') })
    })

    if (fromError) {
      if (state.preview) showHint(cfg, '预览模式：关闭预览', [{ label: '关闭预览', act: dismiss }])
      else later(function () { dismiss() }, 1200)
      return
    }

    if (cfg.voice) later(function () { speak(outroText(cfg), cfg) }, Math.max(0, cfg.voiceLead || 0))

    if (state.preview) {
      showHint(cfg, '预览模式（不会关闭标签页）', [
        { label: '再次播放', act: function () { replay(cfg) } },
        { label: '关闭预览', act: dismiss },
      ])
      return
    }
    later(function () { finishAction(cfg) }, 1100 + (cfg.voice ? 300 : 0))
  }

  function replay(cfg) {
    dismiss(true)
    later(function () { open({ preview: true }) }, 60)
  }

  function showHint(cfg, message, buttons) {
    var nodes = state.nodes
    if (!nodes) return
    nodes.hint.hidden = false
    txt(nodes.hintText, message || '')
    if (state.preview) {
      txt(nodes.hintKey, '')
    } else {
      txt(nodes.hintKey, '请按 Ctrl + W（macOS 为 ⌘ + W）关闭；或点击下方按钮。')
    }
    nodes.hintBtns.textContent = ''
    ;(buttons || []).forEach(function (b) {
      var btn = el('button', '', b.label)
      btn.type = 'button'
      btn.addEventListener('click', function (ev) {
        ev.preventDefault()
        b.act()
      })
      nodes.hintBtns.appendChild(btn)
    })
  }

  function finishAction(cfg) {
    if (state.mode === 'done') return
    state.mode = 'done'
    var action = cfg.endAction || 'close'
    if (action === 'reload') {
      location.reload()
      return
    }
    if (action === 'close') {
      attemptClose(cfg)
      return
    }
    /* endAction === 'card'：停在结束页，交给用户手动关 */
    showStayHint(cfg)
  }

  function showStayHint(cfg) {
    showHint(cfg, '本次会话已结束（当前设置：结束后停留在本页）。', [
      { label: '重新进入', act: function () { location.reload() } },
      { label: '返回页面', act: dismiss },
    ])
  }

  function attemptClose(cfg) {
    try {
      window.close()
    } catch (e) {
      /* 浏览器可能直接抛错，按「没关掉」处理 */
    }
    later(function () {
      if (window.closed) return
      showCloseHint(cfg)
    }, 700)
  }

  function showCloseHint(cfg) {
    if (!state.nodes) return
    showHint(cfg, '浏览器不允许网页自动关闭不是由脚本打开的标签页。', [
      { label: '重试关闭', act: function () { attemptClose(cfg) } },
      { label: '重新进入', act: function () { location.reload() } },
      { label: '返回页面', act: dismiss },
    ])
  }

  /* ------------------------------------------------------------------ 结束 */
  function dismiss(keepQuiet) {
    var root = state.root
    if (!root) return
    clearTimers()
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel() } catch (e) { /* 忽略 */ } }
    if (state.video) {
      try {
        state.video.pause()
        state.video.removeAttribute('src')
        state.video.load()
      } catch (e) { /* 忽略 */ }
    }
    root.classList.remove('dsu2-visible')
    document.documentElement.classList.remove('dsu2-lock')
    offAll()
    var node = root
    later(function () {
      try { node.parentNode && node.parentNode.removeChild(node) } catch (e) { /* 忽略 */ }
    }, keepQuiet ? 0 : 260)
    state.root = null
    state.nodes = null
    state.video = null
    state.mode = 'idle'
    state.preview = false
    state.endOnly = false
    state.videoError = null
    if (window.__DSH_SHUTDOWN_RUNNING__ !== undefined) window.__DSH_SHUTDOWN_RUNNING__ = false
    try {
      if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus()
    } catch (e) { /* 忽略 */ }
  }

  /* ------------------------------------------------------------------ 触发 */
  function open(opts) {
    opts = opts || {}
    if (state.root) return false
    if (startupBusy()) {
      if (opts.preview && window.alert) window.alert('开启动画正在播放，结束动画稍后再试。')
      return false
    }
    if (state.mode !== 'idle') return false
    state.mode = 'loading'
    loadConfig().then(function (cfg) {
      state.mode = 'idle'
      var preview = !!opts.preview
      if (!preview && shouldSkip(cfg)) {
        mount(cfg, { endOnly: true })
        return
      }
      if (!preview && cfg.requireInteraction) {
        var ok = true
        try { ok = window.confirm('结束当前会话，并播放关闭动画？') } catch (e) { ok = true }
        if (!ok) return
      }
      mount(cfg, { preview: preview })
    }).catch(function () {
      state.mode = 'idle'
      mount(state.cfg, { preview: !!opts.preview })
    })
    return true
  }

  function endNow(reason) {
    if (!state.root) return
    if (state.mode !== 'video') return
    if (!state.cfg.allowSkip && reason === 'skip') return
    beginEnding(state.cfg)
  }

  /* ------------------------------------------------------------------ 快捷键 */
  function matchShortcut(ev, spec) {
    if (!spec) return false
    var parts = String(spec).split('+')
    var main = parts.pop()
    if (!main) return false
    var want = { alt: false, shift: false, ctrl: false, meta: false }
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].trim().toLowerCase()
      if (m === 'alt') want.alt = true
      else if (m === 'shift') want.shift = true
      else if (m === 'ctrl' || m === 'control') want.ctrl = true
      else if (m === 'meta' || m === 'cmd' || m === 'command') want.meta = true
      else return false
    }
    if (!!ev.altKey !== want.alt) return false
    if (!!ev.shiftKey !== want.shift) return false
    if (!!ev.ctrlKey !== want.ctrl) return false
    if (!!ev.metaKey !== want.meta) return false
    var key = String(ev.key || '').toLowerCase()
    var need = String(main).trim().toLowerCase()
    if (/^f\d{1,2}$/.test(need)) return key === need
    if (need === 'space') return key === ' ' || key === 'spacebar'
    return key === need
  }

  function onKeydown(ev) {
    if (state.root) {
      if (ev.key === 'Escape' && state.cfg.allowSkip && state.mode === 'video') {
        ev.preventDefault()
        ev.stopPropagation()
        endNow('skip')
      }
      return
    }
    if (isTypingTarget(ev.target)) return
    if (ev.defaultPrevented) return
    if (startupBusy()) return
    if (matchShortcut(ev, state.cfg.shortcut)) {
      ev.preventDefault()
      open({ reason: 'shortcut' })
    }
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    gOn(document, 'keydown', onKeydown, true)
    gOn(window, 'dsh-shutdown:request', function (ev) { open((ev && ev.detail) || {}) })
    gOn(window, 'dsh-shutdown:preview', function () { open({ preview: true }) })
    gOn(window, 'pagehide', function () {
      if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel() } catch (e) { /* 忽略 */ } }
    })
    loadConfig()
  }

  window.__DSH_SHUTDOWN_API__ = {
    open: function (opts) { return open(opts || {}) },
    preview: function () { return open({ preview: true }) },
    close: function () { dismiss() },
    isOpen: function () { return !!state.root },
    reloadConfig: loadConfig,
    version: window.__DSH_SHUTDOWN_VERSION__ || '0.1.0',
  }
  if (window.__DSH_SHUTDOWN_RUNNING__ === undefined) window.__DSH_SHUTDOWN_RUNNING__ = false

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
})()
