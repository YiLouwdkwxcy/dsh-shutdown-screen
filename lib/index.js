/* ============================================================================
 * dsh-shutdown-screen —— Host 半侧
 *
 * 职责：
 *   1) 把「关闭动画」需要的静态资源 / 配置 / 视频（带 Range 206）注册成路由；
 *   2) 通过 webServer.tapIndex 往 index.html 里注入 CSS + 配置 + closing.js；
 *   3) 把配置持久化到 ~/.dsh/dsh-shutdown.json，媒体放在 ~/.dsh/dsh-shutdown/。
 *
 * 设计约束（与 dsh-startup-screen 保持一致）：
 *   - 不导出 default：cordis 插件加载器的 unwrapExports 是 exports.default ?? exports，
 *     只导出具名符号才能拿到 { apply, inject, name }。
 *   - 路由全部走 connection.requestRejection 信任栅栏。
 *   - webServer 不存在时（桌面端 file:// + IPC 形态）只告警、不炸 fiber，
 *     设置页仍然可用，等桌面端适配后再补一条 IPC 通道。
 * ========================================================================== */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(LIB_DIR, '..', 'package.json'), 'utf8'))

export const name = PKG.name
export const inject = ['webServer', 'connection']

const VERSION = PKG.version
const ROUTE_BASE = '/dsh-shutdown'
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-shutdown.json')
const MEDIA_DIR = path.join(DSH_HOME, 'dsh-shutdown')
const LOG_PREFIX = '[dsh-shutdown-screen]'

/**
 * 媒体文件名白名单：单段文件名，mp4/webm/m4v，不允许任何路径分隔符。
 * 支持中文 / 英文等 Unicode 字母数字（\p{L} \p{N}），以及空格、括号、点、下划线和短横线。
 * 长度限制 120，避免异常长名字；控制字符 / 路径分隔符一律不接受。
 */
const MEDIA_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N}._ ()\-[\]（）【】·]{0,119}\.(mp4|webm|m4v)$/iu

const TEXT_KEYS = [
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer',
  'accent', 'glitchA', 'glitchB',
  'voiceName', 'shortcut', 'videoFile',
]
const BOOL_KEYS = [
  'enabled', 'requireInteraction', 'allowSkip',
  'sound', 'voice', 'voiceCue',
  'triggerButton', 'showChrome',
]
const ENUM_KEYS = {
  mode: ['always', 'session', 'daily'],
  theme: ['light', 'dark'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts'],
  voiceLang: ['en', 'zh', 'both'],
  videoFit: ['contain', 'cover'],
  endAction: ['close', 'card', 'reload'],
}

const DEFAULTS = {
  /* —— 播放 —— */
  enabled: true,
  mode: 'always',
  theme: 'dark',
  speed: 1,
  /* —— 交互 —— */
  requireInteraction: true,
  allowSkip: true,
  /* —— 声音 / 语音 / 音效 —— */
  sound: true,
  soundVolume: 0.7,
  voice: true,
  voiceLang: 'zh',
  voiceName: '',
  voiceRate: 0.88,
  voicePitch: 0.85,
  voiceVolume: 0.9,
  voiceCue: true,
  sfx: 'audio',
  voiceSource: 'asset',
  voiceLead: 240,
  /* —— 身份资料 —— */
  identity: 'JOYCE MOORE',
  identityId: '0087',
  accessLevel: '3',
  /* —— 品牌 —— */
  brand1: 'DEEPSEEK',
  brand2: 'SYNTHESIZE INTELLIGENCE',
  brand3a: 'HARNESS',
  brand3b: 'OS',
  /* —— 组织 / 文案 —— */
  orgZh: '深度求索',
  orgEn: 'DEEPSEEK',
  orgSub: 'DEEPSEEK HARNESS',
  welcomeBox: 'SESSION CLOSED',
  footer: 'POWERED BY DEEPSEEK',
  /* —— 视觉 —— */
  accent: '#ff7500',
  glitchA: '#ff3b30',
  glitchB: '#2971b8',
  /* ===== 关闭动画新增 ===== */
  triggerButton: true,
  shortcut: 'Alt+Shift+Q',
  endAction: 'close',
  videoFile: 'closing.mp4',
  videoFit: 'contain',
  playFrom: 0,
  playTo: 0,
  showChrome: true,
  /* 在原视频音量基础上继续放大（1 = 原始音量，3 = 300%） */
  volumeBoost: 1,
}

/* --------------------------------------------------------------------------
 * 配置归一化：类型/范围校验，未知字段丢弃，任何非法值回落到默认值。
 * ------------------------------------------------------------------------ */
function clamp(n, min, max, fallback) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}
function str(v, max, fallback) {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  if (!t) return fallback
  return t.length > max ? t.slice(0, max) : t
}
function normalize(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const out = { ...DEFAULTS }
  for (const k of BOOL_KEYS) if (k in src) out[k] = !!src[k]
  for (const [k, allowed] of Object.entries(ENUM_KEYS)) {
    if (k in src && allowed.includes(String(src[k]))) out[k] = String(src[k])
  }
  for (const k of TEXT_KEYS) {
    if (k in src) out[k] = str(src[k], 240, DEFAULTS[k])
  }
  out.speed = clamp(src.speed, 0.35, 3, DEFAULTS.speed)
  out.volumeBoost = clamp(src.volumeBoost, 1, 3, DEFAULTS.volumeBoost)
  out.soundVolume = clamp(src.soundVolume, 0, 1, DEFAULTS.soundVolume)
  out.voiceVolume = clamp(src.voiceVolume, 0, 1, DEFAULTS.voiceVolume)
  out.voiceRate = clamp(src.voiceRate, 0.5, 2, DEFAULTS.voiceRate)
  out.voicePitch = clamp(src.voicePitch, 0, 2, DEFAULTS.voicePitch)
  out.voiceLead = Math.round(clamp(src.voiceLead, 0, 5000, DEFAULTS.voiceLead))
  out.playFrom = Math.round(clamp(src.playFrom, 0, 36000, DEFAULTS.playFrom))
  out.playTo = Math.round(clamp(src.playTo, 0, 36000, DEFAULTS.playTo))
  if (out.playTo > 0 && out.playTo <= out.playFrom) out.playTo = 0
  out.shortcut = normalizeShortcut(out.shortcut)
  out.videoFile = MEDIA_NAME_RE.test(out.videoFile) ? out.videoFile : DEFAULTS.videoFile
  out.accent = /^#[0-9a-fA-F]{3,8}$/.test(out.accent) ? out.accent : DEFAULTS.accent
  out.glitchA = /^#[0-9a-fA-F]{3,8}$/.test(out.glitchA) ? out.glitchA : DEFAULTS.glitchA
  out.glitchB = /^#[0-9a-fA-F]{3,8}$/.test(out.glitchB) ? out.glitchB : DEFAULTS.glitchB
  return out
}
const SHORTCUT_MODS = new Set(['alt', 'shift', 'ctrl', 'control', 'meta', 'cmd', 'command', 'super', 'win'])
const SHORTCUT_NAMED_KEYS = new Set([
  'escape', 'esc', 'delete', 'del', 'backspace', 'insert', 'home', 'end',
  'pageup', 'pagedown', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'space', 'spacebar', 'tab', 'enter', 'backquote', 'minus', 'equal',
  'bracketleft', 'bracketright', 'backslash', 'semicolon', 'quote', 'comma',
  'period', 'slash', 'pause', 'printscreen',
  'numpadadd', 'numpadsubtract', 'numpadmultiply', 'numpaddivide', 'numpaddecimal', 'numpadenter',
])
function canonicalKey(bare) {
  const l = String(bare).toLowerCase()
  if (/^f([1-9]|1[0-2])$/.test(l)) return 'F' + l.slice(1)
  const named = {
    esc: 'Escape', escape: 'Escape', del: 'Delete', delete: 'Delete',
    space: 'Space', spacebar: 'Space', pageup: 'PageUp', pagedown: 'PageDown',
    arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
    backquote: 'Backquote', minus: 'Minus', equal: 'Equal',
    bracketleft: 'BracketLeft', bracketright: 'BracketRight', backslash: 'Backslash',
    semicolon: 'Semicolon', quote: 'Quote', comma: 'Comma', period: 'Period', slash: 'Slash',
    pause: 'Pause', printscreen: 'PrintScreen',
    numpadadd: 'NumpadAdd', numpadsubtract: 'NumpadSubtract',
    numpadmultiply: 'NumpadMultiply', numpaddivide: 'NumpadDivide',
    numpaddecimal: 'NumpadDecimal', numpadenter: 'NumpadEnter',
  }
  if (named[l]) return named[l]
  if (/^[a-z0-9]$/.test(l)) return l.toUpperCase()
  return null
}
function canonicalMod(m) {
  const l = String(m).toLowerCase()
  if (l === 'alt') return 'Alt'
  if (l === 'shift') return 'Shift'
  if (l === 'ctrl' || l === 'control') return 'Ctrl'
  if (l === 'meta' || l === 'cmd' || l === 'command' || l === 'super' || l === 'win') return 'Meta'
  return null
}
/**
 * 快捷键格式：单键（F8 / Delete / 字母 / 数字 ...）或 Ctrl+Alt+X 组合。
 * 单键也允许：例如 Delete、F8、Q。前台输入框内触发会被忽略（运行时负责）。
 */
function normalizeShortcut(v) {
  const s = str(v, 64, DEFAULTS.shortcut)
  const parts = s.split('+').map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return DEFAULTS.shortcut
  const bare = canonicalKey(parts[parts.length - 1])
  if (!bare) return DEFAULTS.shortcut
  const mods = []
  for (const raw of parts.slice(0, -1)) {
    const m = canonicalMod(raw)
    if (!m) return DEFAULTS.shortcut
    mods.push(m)
  }
  return mods.concat(bare).join('+')
}

/* --------------------------------------------------------------------------
 * 读写配置 / 媒体
 * ------------------------------------------------------------------------ */
function ensureDirs() {
  try { fs.mkdirSync(MEDIA_DIR, { recursive: true }) } catch { /* 只读文件系统时由后续写入报错 */ }
}
function readConfig() {
  ensureDirs()
  try {
    const txt = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(txt))
  } catch {
    const fresh = { ...DEFAULTS }
    try { writeConfig(fresh) } catch { /* 忽略 */ }
    return fresh
  }
}
function writeConfig(cfg) {
  ensureDirs()
  const tmp = CONFIG_FILE + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}
function listMedia() {
  ensureDirs()
  let names = []
  try { names = fs.readdirSync(MEDIA_DIR) } catch { names = [] }
  const files = []
  for (const n of names) {
    if (!MEDIA_NAME_RE.test(n)) continue
    try {
      const st = fs.statSync(path.join(MEDIA_DIR, n))
      if (!st.isFile()) continue
      files.push({ name: n, size: st.size, mtime: st.mtimeMs })
    } catch { /* 跳过读不到的条目 */ }
  }
  files.sort((a, b) => a.name.localeCompare(b.name))
  return files
}
function resolveVideo(cfg) {
  const name = MEDIA_NAME_RE.test(cfg.videoFile) ? cfg.videoFile : DEFAULTS.videoFile
  const file = path.join(MEDIA_DIR, name)
  let exists = false
  let size = 0
  let mtime = 0
  try {
    const st = fs.statSync(file)
    if (st.isFile()) { exists = true; size = st.size; mtime = st.mtimeMs }
  } catch { /* 不存在 */ }
  return { name, file, exists, size, mtime }
}

/** 在系统文件管理器里打开媒体目录（让用户把自己的视频拖进去）。 */
function openMediaDir() {
  ensureDirs()
  /* 测试 / 无头环境用：只返回路径，不真的弹窗口 */
  if (process.env.DSH_SHUTDOWN_OPEN_DRY === '1') return { ok: true, dryRun: true, dir: MEDIA_DIR }
  let cmd
  let args
  if (process.platform === 'win32') { cmd = 'explorer.exe'; args = [MEDIA_DIR] }
  else if (process.platform === 'darwin') { cmd = 'open'; args = [MEDIA_DIR] }
  else { cmd = 'xdg-open'; args = [MEDIA_DIR] }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.on('error', () => { /* 打不开时前端仍能显示路径，用户可手动复制 */ })
    child.unref()
    return { ok: true, dir: MEDIA_DIR }
  } catch (e) {
    return { ok: false, dir: MEDIA_DIR, error: 'open failed: ' + (e && e.message ? e.message : String(e)) }
  }
}

/* --------------------------------------------------------------------------
 * 关闭浏览器窗口
 *
 * 网页自己的 window.close() 对“用户手动打开的标签页”无效（浏览器静默拒绝），
 * 所以退一步：由本机 Host 调 close-window.ps1，用 Windows 窗口消息
 * WM_SYSCOMMAND / SC_CLOSE 模拟“点一下窗口的关闭按钮”。
 * 只对浏览器主窗口生效，优先匹配标题中包含当前页面标题的窗口。
 * ------------------------------------------------------------------------ */
function closeWindow(title) {
  if (process.env.DSH_SHUTDOWN_CLOSE_DRY === '1') {
    return Promise.resolve({ ok: true, dryRun: true, title: String(title || '').slice(0, 200) })
  }
  if (process.platform !== 'win32') {
    return Promise.resolve({ ok: false, error: '仅支持 Windows（当前 ' + process.platform + '）' })
  }
  const script = path.join(LIB_DIR, 'close-window.ps1')
  if (!fs.existsSync(script)) return Promise.resolve({ ok: false, error: 'close-window.ps1 不存在' })
  return new Promise((resolve) => {
    let settled = false
    let child = null
    let timer = null
    const finish = (out) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(out)
    }
    try {
      child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', script,
        '-Title', String(title || '').slice(0, 200),
      ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      resolve({ ok: false, error: 'spawn failed: ' + (e && e.message ? e.message : String(e)) })
      return
    }
    let out = ''
    child.stdout.on('data', (b) => { out += b.toString('utf8') })
    child.stderr.on('data', (b) => { out += b.toString('utf8') })
    child.on('error', (e) => finish({ ok: false, error: 'spawn error: ' + e.message }))
    child.on('close', (code) => finish({ ok: code === 0, code, detail: out.trim().slice(0, 400) }))
    timer = setTimeout(() => {
      try { child.kill() } catch { /* 忽略 */ }
      finish({ ok: false, error: 'timeout' })
    }, 5000)
  })
}
async function handleCloseWindow(req, res) {
  if (req.method !== 'POST') { sendError(res, 405, 'method not allowed'); return }
  let raw
  try {
    raw = await readBody(req, 4 * 1024)
  } catch (e) {
    sendError(res, 413, 'request body too large')
    return
  }
  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    sendError(res, 400, 'invalid JSON body')
    return
  }
  const title = body && typeof body.title === 'string' ? body.title.slice(0, 200) : ''
  const out = await closeWindow(title)
  if (out.ok) sendJson(res, 200, out)
  else sendError(res, 502, out.error || 'close window failed')
}

/* --------------------------------------------------------------------------
 * HTTP 小工具
 * ------------------------------------------------------------------------ */
function sendJson(res, code, obj, extra) {
  if (res.headersSent || res.writableEnded) return
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...(extra || {}),
  })
  res.end(body)
}
function sendText(res, code, text, type) {
  if (res.headersSent || res.writableEnded) return
  const body = String(text)
  res.writeHead(code, {
    'content-type': (type || 'text/plain') + '; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}
function sendError(res, code, message) {
  sendJson(res, code, { ok: false, error: message })
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (buf) => {
      size += buf.length
      if (size > limit) { reject(new Error('body too large')); req.destroy?.(); return }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
function isTrusted(connection, req) {
  if (!connection || typeof connection.requestRejection !== 'function') return { ok: true }
  try {
    const verdict = connection.requestRejection(req)
    return verdict ? { ok: false, code: Number(verdict) || 403 } : { ok: true }
  } catch {
    return { ok: false, code: 403 }
  }
}
/** mtime 缓存的文件读取器：开发时改 lib/*.js 立刻生效，不需要重装插件。 */
function makeReader(file, contentType) {
  let cache = { mtime: -1, body: null }
  return function get() {
    const st = fs.statSync(file)
    if (cache.body === null || st.mtimeMs !== cache.mtime) {
      cache = { mtime: st.mtimeMs, body: fs.readFileSync(file) }
    }
    return { body: cache.body, contentType, mtime: st.mtimeMs }
  }
}
const readers = {
  css: makeReader(path.join(LIB_DIR, 'closing.css'), 'text/css'),
  js: makeReader(path.join(LIB_DIR, 'closing.js'), 'text/javascript'),
}
function serveAsset(res, getter, extraHeaders) {
  try {
    const { body, contentType, mtime } = getter()
    res.writeHead(200, {
      'content-type': contentType + '; charset=utf-8',
      'cache-control': 'no-cache',
      'content-length': body.length,
      'last-modified': new Date(mtime).toUTCString(),
      ...(extraHeaders || {}),
    })
    res.end(body)
  } catch (e) {
    sendError(res, 500, 'asset unavailable: ' + e.message)
  }
}

/* --------------------------------------------------------------------------
 * 视频（必须支持 Range：<video> 拖动与部分浏览器分段请求都靠它）
 * ------------------------------------------------------------------------ */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim())
  if (!m) return null
  if (m[1] === '' && m[2] === '') return null
  let start
  let end
  if (m[1] === '') {
    const suffix = Number(m[2])
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Number(m[2])
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start < 0 || start >= size) return null
  end = Math.min(end, size - 1)
  if (end < start) return null
  return { start, end }
}
function serveVideo(req, res, cfg) {
  const info = resolveVideo(cfg)
  if (!info.exists) {
    sendError(res, 404, '视频文件不存在：' + info.file + '（把视频放到该路径，或在设置页选择其它文件）')
    return
  }
  const total = info.size
  const range = parseRange(req.headers?.range, total)
  const base = {
    'accept-ranges': 'bytes',
    'content-type': 'video/mp4',
    'cache-control': 'no-cache',
    'last-modified': new Date(info.mtime).toUTCString(),
  }
  if (range) {
    res.writeHead(206, {
      ...base,
      'content-range': 'bytes ' + range.start + '-' + range.end + '/' + total,
      'content-length': range.end - range.start + 1,
    })
  } else {
    res.writeHead(200, { ...base, 'content-length': total })
  }
  if (req.method === 'HEAD') { res.end(); return }
  const stream = fs.createReadStream(info.file, range ? { start: range.start, end: range.end } : undefined)
  stream.on('error', () => { try { res.destroy() } catch { /* 忽略 */ } })
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

/* --------------------------------------------------------------------------
 * index.html 注入
 * ------------------------------------------------------------------------ */
const CRITICAL_CSS = [
  'html.dsu2-lock,html.dsu2-lock body{overflow:hidden!important}',
  'html.dsu2-lock{overscroll-behavior:none}',
  '#dsh-shutdown-root *{box-sizing:border-box}',
].join('\n')

function buildBootScript(cfg) {
  const cfgJson = JSON.stringify(cfg).replace(/</g, '\\u003c')
  return [
    '<script>',
    'window.__DSH_SHUTDOWN_BOOT__="index";',
    'window.__DSH_SHUTDOWN_VERSION__=' + JSON.stringify(VERSION) + ';',
    'window.__DSH_SHUTDOWN_ROUTE__=' + JSON.stringify(ROUTE_BASE) + ';',
    'window.__DSH_SHUTDOWN__=' + cfgJson + ';',
    '</script>',
    '<script defer src="' + ROUTE_BASE + '/closing.js"></script>',
  ].join('')
}
function injectIndex(html) {
  if (typeof html !== 'string') return html
  if (html.includes(ROUTE_BASE + '/closing.js')) return html
  const cfg = readConfig()
  const head = [
    '<link rel="stylesheet" href="' + ROUTE_BASE + '/closing.css">',
    '<style id="dsh-shutdown-critical">' + CRITICAL_CSS + '</style>',
  ].join('\n')
  let out = html
  if (out.includes('</head>')) out = out.replace('</head>', head + '\n</head>')
  else out = head + out
  const boot = buildBootScript(cfg)
  const bodyIdx = out.lastIndexOf('</body>')
  if (bodyIdx >= 0) out = out.slice(0, bodyIdx) + boot + '\n' + out.slice(bodyIdx)
  else out = out + boot
  return out
}

/* --------------------------------------------------------------------------
 * webServer 解析
 * ------------------------------------------------------------------------ */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch { /* ctx.get 失败就退回属性 */ }
  return ctx.webServer
}
function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

/* --------------------------------------------------------------------------
 * 路由
 * ------------------------------------------------------------------------ */
function routeTable(ctx) {
  return [
    /* 配置读写 */
    { kind: 'exact', path: ROUTE_BASE + '/config', handler: handleConfig },
    /* 运行时 / 样式 */
    { kind: 'exact', path: ROUTE_BASE + '/closing.js', handler: (req, res) => serveAsset(res, readers.js) },
    { kind: 'exact', path: ROUTE_BASE + '/closing.css', handler: (req, res) => serveAsset(res, readers.css) },
    /* 媒体 */
    { kind: 'exact', path: ROUTE_BASE + '/media', handler: handleMedia },
    { kind: 'exact', path: ROUTE_BASE + '/open-media-dir', handler: handleOpenMediaDir },
    /* 静默退出：由本机模拟点击浏览器窗口的关闭按钮 */
    { kind: 'exact', path: ROUTE_BASE + '/close-window', handler: handleCloseWindow },
    { kind: 'exact', path: ROUTE_BASE + '/video', handler: (req, res) => serveVideo(req, res, readConfig()) },
  ]
}
async function handleConfig(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const config = readConfig()
    const video = resolveVideo(config)
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      config,
      defaults: DEFAULTS,
      configFile: CONFIG_FILE,
      mediaDir: MEDIA_DIR,
      video: {
        name: video.name,
        exists: video.exists,
        size: video.size,
        mtime: video.mtime,
        url: ROUTE_BASE + '/video',
      },
      files: listMedia(),
    })
    return
  }
  if (req.method !== 'POST') { sendError(res, 405, 'method not allowed'); return }
  let raw
  try {
    raw = await readBody(req, 64 * 1024)
  } catch (e) {
    sendError(res, 413, 'request body too large')
    return
  }
  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    sendError(res, 400, 'invalid JSON body')
    return
  }
  const current = readConfig()
  let next = current
  if (body && body.action === 'reset') next = { ...DEFAULTS }
  else if (body && body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)) {
    next = normalize({ ...current, ...body.patch })
  } else {
    sendError(res, 400, 'expect { patch: {...} } or { action: "reset" }')
    return
  }
  writeConfig(next)
  const video = resolveVideo(next)
  sendJson(res, 200, {
    ok: true,
    version: VERSION,
    config: next,
    video: { name: video.name, exists: video.exists, size: video.size, mtime: video.mtime, url: ROUTE_BASE + '/video' },
    files: listMedia(),
  })
}
function handleMedia(req, res) {
  const config = readConfig()
  sendJson(res, 200, {
    ok: true,
    mediaDir: MEDIA_DIR,
    current: config.videoFile,
    files: listMedia(),
  })
}
function handleOpenMediaDir(req, res) {
  if (req.method !== 'POST') { sendError(res, 405, 'method not allowed'); return }
  const out = openMediaDir()
  if (out.ok) sendJson(res, 200, out)
  else sendError(res, 500, out.error || 'open failed')
}

/* --------------------------------------------------------------------------
 * 插件入口
 * ------------------------------------------------------------------------ */
export function apply(ctx) {
  const disposers = []
  const cleanup = () => {
    for (const d of disposers.splice(0)) {
      try { d() } catch { /* 幂等清理 */ }
    }
  }
  const webServer = resolveWebServer(ctx)
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined

  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(LOG_PREFIX + ' webServer 不可用：设置页可用，关闭动画需要 Web 端（桌面端待适配）')
    } catch { /* 忽略 */ }
    return
  }

  const guard = (handler) => async (req, res) => {
    const trust = isTrusted(connection, req)
    if (!trust.ok) {
      try { res.writeHead(trust.code); res.end('forbidden') } catch { /* 连接已断开 */ }
      return
    }
    try {
      await handler(req, res)
    } catch (e) {
      try {
        if (!res.headersSent) sendError(res, 500, 'internal error: ' + (e && e.message ? e.message : String(e)))
        else res.destroy?.()
      } catch { /* 忽略 */ }
    }
  }

  for (const route of routeTable(ctx)) {
    try {
      const dispose = webServer.register({ kind: route.kind, path: route.path, handler: guard(route.handler) })
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (e) {
      try { ctx.logger?.warn?.(LOG_PREFIX + ' 路由注册失败 ' + route.path + ': ' + e.message) } catch { /* 忽略 */ }
    }
  }
  try {
    const dispose = webServer.tapIndex(injectIndex)
    if (typeof dispose === 'function') disposers.push(dispose)
  } catch (e) {
    try { ctx.logger?.warn?.(LOG_PREFIX + ' tapIndex 注入失败: ' + e.message) } catch { /* 忽略 */ }
  }
  if (typeof ctx.effect === 'function') {
    try { ctx.effect(() => cleanup) } catch { /* 旧版本 fiber 没有 effect 时忽略 */ }
  }
}
