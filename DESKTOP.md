# DSH 桌面端（DSH Desktop）兼容性

本文件说明 `dsh-shutdown-screen` 在 **DSH 桌面端** 的情况。先说结论：

- **Web（浏览器）端：完整支持**，这是本插件主要验证和使用的形态。
- **桌面端：本机没有安装，未做实测**，因此下面依据的是 DSH 桌面端（Next）的代码结构与机制分析，
  不是实测承诺。机制上看，**设置页和动画预计可用**；「播放完自动关闭窗口」的行为待验证。

## 当前测试状态

- 本机（2026-11-09）**没有安装 DSH 桌面端**，只有安装包
  `D:\\整合\\Downloads\\Xz\\DSH-Desktop-2.0.17-x64-Setup.exe`，无法做桌面端实测。
- 本插件全部验证都在 **DSH Web 0.2.2-rc.1** 上完成（设置页、侧栏按钮、快捷键、播放、
  结束画面、静默关闭、Range 206 等）。
- 本机另一份 DSH 桌面端（Next）安装目录 `D:\\dd\\DSH NEXT` 只用于读代码确认机制，未启动。

## 桌面端（Next）的运行形态（代码依据）

- 桌面端不是简单用 `file://` 加载前端：`resources/app/host.cordis.patch.yml` 里禁用了标准
  `webserver`，插入桌面自己的 `dsh-desktop-next/webserver`（监听 `127.0.0.1:0` 随机端口）；
  它的 `lib/webserver.js` 继承 `@deepseek-ai/dsh-host-webserver`，包装
  `register` / `registerFallback` / `registerUpgrade`。**所以插件注册的 HTTP 路由在桌面端可用。**
- SPA 页面走 `dsh-app://app/` 协议（`lib/main.js` 里 `protocol.handle("dsh-app")`），其余请求由
  `forwardWebRequest` 转给本机 Host（`web-document.js`）。
- 页面注入（`webServer.tapIndex` 的 HTML 改写）在桌面端**不生效**：桌面端的首屏注入走
  `ctx.webServer.collectIndexInjections()` + `IPC.boot`，不是对磁盘 HTML 字符串做替换。
  同类实证：`dsh-startup-screen` 的 `DESKTOP.md` 也写明「桌面端组合里同样挂 dsh-web-app，
  所以有 webServer 服务；插件注册的路由两边都能用，只有首屏注入退化（可自举）」。

## 对本插件的影响

| 部分 | Web 端 | 桌面端（机制分析，未实测） |
| --- | --- | --- |
| 设置页「关闭动画」、侧栏退出按钮 | 支持 | 客户端 bundle 由 shell carrier 经 IPC 加载，设置页与按钮**预计可用** |
| 视频播放、结束画面、结束语 | 支持 | 渲染进程与浏览器同源，**预计可用** |
| Host 路由（config / 视频流 / Range 206 / close-window） | 支持 | 桌面端有自己的 webServer，`register` 类路由**预计可用** |
| 首屏 `<link>` / `<script defer>` 注入 | 支持 | **不生效**（`tapIndex` 在桌面端不执行） |
| 动画运行时加载 | 由首屏注入 | 由 `lib/client.js` 的 `ensureRuntime()` **自举**：检测不到 `window.__DSH_SHUTDOWN_API__` 时，动态插入 `closing.css` + `closing.js`，再从 `/dsh-shutdown/config` 拉配置。这正是为注入退化准备的路径 |
| `window.close()` | 普通标签页通常被浏览器拒绝 | Electron 渲染进程里可能直接关掉窗口，**未实测** |
| Windows `WM_SYSCOMMAND / SC_CLOSE` 关闭助手（`lib/close-window.ps1`） | Windows 上可用 | **不适用**：它按浏览器进程名匹配窗口（msedge/chrome/…），Electron 进程不在白名单；关不掉时会停在结束画面并提示 `Ctrl+W` |
| 「点窗口 × 时播放动画」 | 浏览器不允许 | Electron 主进程可以拦截 `BrowserWindow` close 事件，但本插件**没有做这层 IPC** |

## 已知限制与注意

1. `package.json` 里 `dsh.client.platform` 写的是 `web`；桌面端是否按该字段过滤客户端 bundle
   尚未实测。若桌面端不加载客户端 bundle，则只能依赖首屏注入，而首屏注入在桌面端不生效，
   届时设置页和动画都不会出现——这是桌面端最大的不确定点。
2. 桌面端安装/更新走同一套 plugin-manager + 内置 pnpm（应用内「设置 → 插件」）。
   命令行操作前需要**完全退出桌面端**（profile 被 Electron 独占）。
3. 若在桌面端实测，请附：DSH 桌面端版本、操作系统、设置页是否出现、触发后是否播放、
   关闭时的实际表现。

## 如果你需要「点桌面端窗口 × 时播动画」

那需要单独的 Electron 主进程插件：在 `BrowserWindow` 的 `close` 事件里 `preventDefault()`，
播放动画，结束后再 `app.quit()`。这需要在 DSH 桌面端暴露插件侧 IPC 通道，本插件（纯 HTTP
路由 + 浏览器运行时）拿不到这个钩子，因此不作为当前版本的承诺。

## 结论

- **Web（浏览器）端：完整支持**，可以正常安装、使用、更新。
- **桌面端：未实测**。机制上设置页与动画应能工作（靠客户端自举），自动关窗行为不确定；
  不建议把桌面端当作已验证能力。
