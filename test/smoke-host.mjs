/* ============================================================================
 * Host 半侧冒烟测试 —— 不装进 DSH，直接用假 ctx 把 apply() 跑一遍。
 * 覆盖：路由注册 / 信任栅栏 / 配置读写与归一化 / 视频 Range 206 /
 *       媒体列表 / index.html 注入 / XSS 边界。
 * 用法：node test/smoke-host.mjs
 * ========================================================================== */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Writable } from 'node:stream'
import { finished } from 'node:stream/promises'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8'))

const SMOKE_HOME = path.join(os.tmpdir(), 'dsh-shutdown-smoke-' + Date.now())
fs.mkdirSync(SMOKE_HOME, { recursive: true })
process.env.DSH_HOME = SMOKE_HOME

/* DSH dist/index.html 形状的最小样本（和真机一致：属性都带引号、有 #root） */
const SAMPLE_INDEX = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="utf-8" />',
  '    <title>DeepSeek Harness</title>',
  '    <script type="module" crossorigin src="./assets/index-XXX.js"></script>',
  '    <link rel="stylesheet" crossorigin href="./assets/vendor-XXX.css">',
  '  </head>',
  '  <body>',
  '    <div id="root"></div>',
  '  </body>',
  '</html>',
  '',
].join('\n')

const ROUTES = new Map()
const TAPS = []
let effects = 0
let rejectNext = undefined

const ctx = {
  webServer: {
    register(route) {
      if (ROUTES.has(route.kind + ' ' + route.path)) throw new Error('duplicate route ' + route.path)
      ROUTES.set(route.kind + ' ' + route.path, route)
      return () => ROUTES.delete(route.kind + ' ' + route.path)
    },
    tapIndex(fn) { TAPS.push(fn); return () => TAPS.splice(TAPS.indexOf(fn), 1) },
  },
  get(name) {
    if (name !== 'connection') return undefined
    return { requestRejection() { return rejectNext } }
  },
  effect(fn) { effects++; const d = fn(); return () => { if (typeof d === 'function') d() } },
}

class FakeReq extends EventEmitter {
  constructor(method, body, url, headers) {
    super()
    this.method = method
    this.url = url || '/'
    this.headers = Object.assign({ host: '127.0.0.1:3080' }, headers || {})
    process.nextTick(() => {
      if (body !== undefined) this.emit('data', Buffer.from(body))
      this.emit('end')
    })
  }
}

function fakeRes() {
  const chunks = []
  const writable = new Writable({
    write(chunk, _enc, cb) { chunks.push(Buffer.from(chunk)); cb() },
  })
  writable.statusCode = 0
  writable.headers = null
  writable.body = Buffer.alloc(0)
  writable.writeHead = function (code, headers) {
    this.statusCode = code
    this.headers = headers || {}
    return this
  }
  const end = writable.end.bind(writable)
  writable.end = function (buf) {
    if (buf !== undefined) chunks.push(Buffer.from(buf))
    writable.body = Buffer.concat(chunks)
    return end()
  }
  return writable
}

async function call(kindPath, method = 'GET', body, url, headers) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const req = new FakeReq(method, body, url, headers)
  const res = fakeRes()
  await route.handler(req, res)
  if (method !== 'HEAD') {
    try { await finished(res) } catch { /* 已结束 */ }
  }
  return res
}
function json(res) { return JSON.parse(res.body.toString('utf8')) }

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

console.log('\n[1] 模块导出形状（对齐 cordis-plugin-loader 的 unwrapExports）')
const mod = await import(pathToFileURL(path.join(PLUGIN_ROOT, 'lib', 'index.js')).href)
check('有具名 name', typeof mod.name === 'string', mod.name)
check('name = dsh-shutdown-screen', mod.name === 'dsh-shutdown-screen', mod.name)
check('name 与 package.json 一致', mod.name === PKG.name)
check('有具名 inject', Array.isArray(mod.inject), JSON.stringify(mod.inject))
check('inject 含 webServer + connection', mod.inject.includes('webServer') && mod.inject.includes('connection'))
check('有具名 apply', typeof mod.apply === 'function')
check('没有 default 导出（避免 unwrapExports 只认 default）', mod.default === undefined, String(mod.default))

console.log('\n[2] apply(ctx)：路由与注入')
mod.apply(ctx)
check('注册了 7 条路由', ROUTES.size === 7, [...ROUTES.keys()].join(' | '))
for (const p of ['/dsh-shutdown/config', '/dsh-shutdown/closing.js', '/dsh-shutdown/closing.css', '/dsh-shutdown/media', '/dsh-shutdown/open-media-dir', '/dsh-shutdown/close-window', '/dsh-shutdown/video']) {
  check('有 exact ' + p, ROUTES.has('exact ' + p))
}
check('注册了 1 个 tapIndex', TAPS.length === 1)
check('用了 ctx.effect 管理生命周期', effects === 1, String(effects))

console.log('\n[3] 静态资源路由')
let r = await call('exact /dsh-shutdown/closing.css')
check('closing.css 200 + text/css', r.statusCode === 200 && /text\/css/.test(r.headers['content-type']), r.headers['content-type'])
check('closing.css 非空', r.body.length > 5000, r.body.length + ' bytes')
r = await call('exact /dsh-shutdown/closing.js')
check('closing.js 200 + javascript', r.statusCode === 200 && /javascript/.test(r.headers['content-type']), r.headers['content-type'])
check('closing.js 非空', r.body.length > 10000, r.body.length + ' bytes')
check('closing.js 有 __DSH_SHUTDOWN_API__ 导出', r.body.toString('utf8').includes('__DSH_SHUTDOWN_API__'))
check('closing.js 含静默退出 closeTab', r.body.toString('utf8').includes('function closeTab'))
check('closing.js 会请求关闭窗口（虚拟点击 X）', r.body.toString('utf8').includes("/close-window"))
check('closing.js 不再用 about:blank 兜底（无黑幕/白幕）', !r.body.toString('utf8').includes('about:blank'))
check('closing.js 恢复结束语（TTS）', r.body.toString('utf8').includes('speak(outro'))
check('closing.js 恢复结束画面（close 模式也显示）', r.body.toString('utf8').includes('nodes.end.hidden = false'))
check('closing.js 不含 confirm()/alert()', !/window\.(confirm|alert)\s*\(/.test(r.body.toString('utf8')))
check('closing.js 不再有 veil 点击播放层', !r.body.toString('utf8').includes('dsu2-veil'))
check('closing.js 启动已结束时不再误判为忙', r.body.toString('utf8').includes("if (window.__DSH_STARTUP_FINISHED__ === true) return false"))

console.log('\n[4] 配置读写落盘 + 归一化')
r = await call('exact /dsh-shutdown/config')
let cfg = json(r)
check('GET config ok', cfg.ok === true)
check('返回版本号', typeof cfg.version === 'string' && /^\d+\.\d+\.\d+/.test(cfg.version), cfg.version)
check('默认身份名称 = JOYCE MOORE', cfg.config.identity === 'JOYCE MOORE', cfg.config.identity)
check('默认视频文件 = closing.mp4', cfg.config.videoFile === 'closing.mp4', cfg.config.videoFile)
check('默认触发按钮开', cfg.config.triggerButton === true)
check('默认快捷键 Alt+Shift+Q', cfg.config.shortcut === 'Alt+Shift+Q', cfg.config.shortcut)
check('返回 configFile 落在 DSH_HOME', typeof cfg.configFile === 'string' && cfg.configFile.startsWith(SMOKE_HOME), cfg.configFile)
check('返回 mediaDir 落在 DSH_HOME', typeof cfg.mediaDir === 'string' && cfg.mediaDir.startsWith(SMOKE_HOME), cfg.mediaDir)
check('返回 video 描述', cfg.video && cfg.video.name === 'closing.mp4' && cfg.video.exists === false, JSON.stringify(cfg.video))
check('默认配置已落盘', fs.existsSync(path.join(SMOKE_HOME, 'dsh-shutdown.json')))

r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({
  patch: {
    identity: '琉璃', speed: 99, soundVolume: 9, enabled: 'true', volumeBoost: 9,
    shortcut: 'Q', endAction: 'nope', videoFile: '../../evil.mp4',
    playFrom: 5, playTo: 3, theme: 'neon',
  },
}))
cfg = json(r)
check('POST config ok', cfg.ok === true)
check('中文身份写入成功', cfg.config.identity === '琉璃', cfg.config.identity)
check('speed 夹到 3', cfg.config.speed === 3, String(cfg.config.speed))
check('soundVolume 夹到 1', cfg.config.soundVolume === 1, String(cfg.config.soundVolume))
check('volumeBoost 夹到 3', cfg.config.volumeBoost === 3, String(cfg.config.volumeBoost))
check('字符串 "true" 转成 boolean true', cfg.config.enabled === true)
check('单键快捷键保留（Q）', cfg.config.shortcut === 'Q', cfg.config.shortcut)
check('非法 endAction 回落到 close', cfg.config.endAction === 'close', cfg.config.endAction)
check('目录穿越的 videoFile 回落到 closing.mp4', cfg.config.videoFile === 'closing.mp4', cfg.config.videoFile)
check('playTo <= playFrom 时归零', cfg.config.playTo === 0, String(cfg.config.playTo))
check('非法 theme 回落到 dark', cfg.config.theme === 'dark', cfg.config.theme)

r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { shortcut: 'Ctrl+Shift+E', speed: 0.01, playFrom: 1.4 } }))
cfg = json(r)
check('合法快捷键保留', cfg.config.shortcut === 'Ctrl+Shift+E', cfg.config.shortcut)
check('speed 夹到 0.35', cfg.config.speed === 0.35, String(cfg.config.speed))
check('playFrom 取整', cfg.config.playFrom === 1, String(cfg.config.playFrom))

r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { shortcut: 'f8', volumeBoost: 0.5 } }))
cfg = json(r)
check('单键快捷键 f8 规范化成 F8', cfg.config.shortcut === 'F8', cfg.config.shortcut)
check('volumeBoost 下限夹到 1', cfg.config.volumeBoost === 1, String(cfg.config.volumeBoost))

r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { shortcut: 'Ctrl+', volumeBoost: 1.75 } }))
cfg = json(r)
check('残缺快捷键回落到默认', cfg.config.shortcut === 'Alt+Shift+Q', cfg.config.shortcut)
check('合法 volumeBoost 保留（1.75）', cfg.config.volumeBoost === 1.75, String(cfg.config.volumeBoost))

r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ action: 'reset' }))
check('reset 恢复默认身份', json(r).config.identity === 'JOYCE MOORE')

r = await call('exact /dsh-shutdown/config', 'POST', '{ not json')
check('非法 JSON 返回 400', r.statusCode === 400, String(r.statusCode))
r = await call('exact /dsh-shutdown/config', 'POST', '{}')
check('缺 patch/action 返回 400', r.statusCode === 400, String(r.statusCode))
r = await call('exact /dsh-shutdown/config', 'DELETE')
check('不支持的方法返回 405', r.statusCode === 405, String(r.statusCode))

console.log('\n[5] 信任栅栏（DNS 重绑定 / 未认证请求）')
rejectNext = 403
r = await call('exact /dsh-shutdown/config')
check('connection 拒绝时 403 且不吐配置', r.statusCode === 403 && r.body.toString('utf8') === 'forbidden', r.statusCode + ' body=' + JSON.stringify(r.body.toString('utf8')))
rejectNext = undefined

console.log('\n[6] 视频路由：404 / Range 206 / 全量 200')
r = await call('exact /dsh-shutdown/video')
check('没有视频文件时 404 + JSON 错误', r.statusCode === 404 && json(r).ok === false, String(r.statusCode))
const MEDIA = path.join(SMOKE_HOME, 'dsh-shutdown')
fs.mkdirSync(MEDIA, { recursive: true })
const VIDEO_BYTES = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz')
fs.writeFileSync(path.join(MEDIA, 'closing.mp4'), VIDEO_BYTES)

r = await call('exact /dsh-shutdown/video', 'HEAD', undefined, '/dsh-shutdown/video', { range: 'bytes=0-3' })
check('Range 请求返回 206', r.statusCode === 206, String(r.statusCode))
check('content-range 正确', r.headers['content-range'] === 'bytes 0-3/36', r.headers['content-range'])
check('content-length = 4', String(r.headers['content-length']) === '4', String(r.headers['content-length']))
check('accept-ranges: bytes', r.headers['accept-ranges'] === 'bytes')
check('HEAD 无 body', r.body.length === 0, String(r.body.length))

r = await call('exact /dsh-shutdown/video', 'HEAD', undefined, '/dsh-shutdown/video', { range: 'bytes=-4' })
check('后缀 Range 正确', r.statusCode === 206 && r.headers['content-range'] === 'bytes 32-35/36', r.headers['content-range'])

r = await call('exact /dsh-shutdown/video', 'HEAD', undefined, '/dsh-shutdown/video', { range: 'bytes=100-200' })
check('越界 Range 回落到全量 200', r.statusCode === 200, String(r.statusCode))

r = await call('exact /dsh-shutdown/video', 'HEAD')
check('无 Range 返回 200 + 全量长度', r.statusCode === 200 && String(r.headers['content-length']) === '36', String(r.headers['content-length']))

r = await call('exact /dsh-shutdown/video', 'GET', undefined, '/dsh-shutdown/video', { range: 'bytes=2-6' })
check('GET Range 返回正确字节', r.statusCode === 206 && r.body.toString('utf8') === '23456', JSON.stringify(r.body.toString('utf8')))

console.log('\n[7] 媒体列表')
r = await call('exact /dsh-shutdown/media')
let media = json(r)
check('media ok + 列出 closing.mp4', media.ok === true && media.files.some((f) => f.name === 'closing.mp4'), JSON.stringify(media.files))
check('媒体列表带大小', media.files[0].size === VIDEO_BYTES.length, String(media.files[0].size))
fs.writeFileSync(path.join(MEDIA, 'not-a-video.txt'), 'x')
media = json(await call('exact /dsh-shutdown/media'))
check('非视频扩展名被过滤', media.files.every((f) => f.name.endsWith('.mp4')), JSON.stringify(media.files.map((f) => f.name)))

console.log('\n[7.1] 中文 / 英文文件名识别')
const CN_NAME = '中文 测试视频-01.mp4'
const CN_BYTES = Buffer.from('chinese-name-video-bytes')
fs.writeFileSync(path.join(MEDIA, CN_NAME), CN_BYTES)
media = json(await call('exact /dsh-shutdown/media'))
check('中文文件名出现在媒体列表', media.files.some((f) => f.name === CN_NAME), JSON.stringify(media.files.map((f) => f.name)))
r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { videoFile: CN_NAME } }))
cfg = json(r)
check('中文文件名可保存为当前视频', cfg.config.videoFile === CN_NAME, cfg.config.videoFile)
check('中文视频 exists = true', cfg.video && cfg.video.exists === true && cfg.video.size === CN_BYTES.length, JSON.stringify(cfg.video))
r = await call('exact /dsh-shutdown/video', 'HEAD', undefined, '/dsh-shutdown/video')
check('中文视频可被 HTTP 路由读出', r.statusCode === 200 && String(r.headers['content-length']) === String(CN_BYTES.length), r.statusCode + ' len=' + r.headers['content-length'])
r = await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { videoFile: 'closing.mp4' } }))
check('恢复英文文件名', json(r).config.videoFile === 'closing.mp4')

console.log('\n[7.2] 打开媒体目录（dry-run）')
r = await call('exact /dsh-shutdown/open-media-dir', 'GET')
check('打开媒体目录只接受 POST（GET 405）', r.statusCode === 405, String(r.statusCode))
process.env.DSH_SHUTDOWN_OPEN_DRY = '1'
r = await call('exact /dsh-shutdown/open-media-dir', 'POST', '{}')
const openResult = json(r)
check('POST 打开媒体目录返回 200 + ok', r.statusCode === 200 && openResult.ok === true, r.statusCode + ' ' + JSON.stringify(openResult))
check('dry-run 返回 mediaDir 路径', typeof openResult.dir === 'string' && openResult.dir.startsWith(SMOKE_HOME), String(openResult.dir))
delete process.env.DSH_SHUTDOWN_OPEN_DRY

console.log('\\n[7.3] 模拟点击窗口关闭按钮（dry-run）')
r = await call('exact /dsh-shutdown/close-window', 'GET')
check('关闭窗口只接受 POST（GET 405）', r.statusCode === 405, String(r.statusCode))
process.env.DSH_SHUTDOWN_CLOSE_DRY = '1'
r = await call('exact /dsh-shutdown/close-window', 'POST', JSON.stringify({ title: 'DeepSeek Harness' }))
const closeResult = json(r)
check('POST 关闭窗口 dry-run 返回 200 + ok', r.statusCode === 200 && closeResult.ok === true, r.statusCode + ' ' + JSON.stringify(closeResult))
check('dry-run 回显标题', closeResult.dryRun === true && closeResult.title === 'DeepSeek Harness', JSON.stringify(closeResult))
delete process.env.DSH_SHUTDOWN_CLOSE_DRY

console.log('\n[8] index.html 注入')
const after = TAPS[0](SAMPLE_INDEX)
check('注入 closing.css link', after.includes('<link rel="stylesheet" href="/dsh-shutdown/closing.css">'))
check('注入 critical style', after.includes('id="dsh-shutdown-critical"') && after.includes('dsu2-lock'))
check('注入 BOOT 标记', after.includes('window.__DSH_SHUTDOWN_BOOT__="index"'))
check('注入版本号 = package.json', after.includes('window.__DSH_SHUTDOWN_VERSION__=' + JSON.stringify(PKG.version)), PKG.version)
check('注入 ROUTE', after.includes('window.__DSH_SHUTDOWN_ROUTE__="/dsh-shutdown"'))
check('注入 defer 运行时脚本', after.includes('<script defer src="/dsh-shutdown/closing.js"></script>'))
check('注入的配置是合法 JSON 且含 42 个键', (() => {
  const a = after.indexOf('window.__DSH_SHUTDOWN__=')
  const b = after.indexOf(';</script>', a)
  if (a < 0 || b < 0) return false
  try {
    const payload = JSON.parse(after.slice(a + 'window.__DSH_SHUTDOWN__='.length, b))
    return Object.keys(payload).length === 42
  } catch { return false }
})())
check('配置落在 </head> 之前', after.indexOf('dsh-shutdown-critical') < after.indexOf('</head>'))
check('脚本落在 </body> 之前', after.indexOf('closing.js') < after.indexOf('</body>'))
check('幂等：二次调用不重复注入', TAPS[0](after) === after)
check('原 <div id="root"></div> 仍在', after.includes('<div id="root"></div>'))

console.log('\n[9] XSS 边界：文案里的尖括号不会逃出内联脚本')
await call('exact /dsh-shutdown/config', 'POST', JSON.stringify({ patch: { identity: '</script><img src=x onerror=alert(1)>' } }))
const injected = TAPS[0](SAMPLE_INDEX)
const p = injected.slice(injected.indexOf('window.__DSH_SHUTDOWN__='), injected.indexOf(';</script>', injected.indexOf('window.__DSH_SHUTDOWN__=')))
check('尖括号被转义成 \\u003c', p.includes('\\u003c'), p.slice(0, 120))
check('载荷里没有裸的 </script>', !p.includes('</script>'))
check('转义后仍是合法 JSON 且值可还原', (() => {
  try { return JSON.parse(p.slice('window.__DSH_SHUTDOWN__='.length)).identity === '</script><img src=x onerror=alert(1)>' } catch { return false }
})())

console.log('\n[10] 内容类型')
r = await call('exact /dsh-shutdown/video', 'HEAD')
check('视频 MIME = video/mp4', r.headers['content-type'] === 'video/mp4', r.headers['content-type'])

fs.rmSync(SMOKE_HOME, { recursive: true, force: true })
console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)

