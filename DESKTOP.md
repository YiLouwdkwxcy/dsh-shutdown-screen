# DSH 桌面端（DSH Desktop）兼容性

本文件说明 `dsh-shutdown-screen` 在 **DSH 桌面端** 的情况。结论先说：**Web 端完整支持；
桌面端未实测，不能宣称可用。** 下面是依据和原因。

## 当前测试状态

- 本机（2026-11-09）**没有安装 DSH 桌面端**，只有安装包
  `D:\整合\Downloads\Xz\DSH-Desktop-2.0.17-x64-Setup.exe`，因此无法做桌面端实测。
- 本插件所有验证都在 **DSH Web 0.2.2-rc.1** 上完成（设置页、侧栏按钮、快捷键、播放、
  结束画面、静默关闭、Range 206 等）。
- 插件声明 `dsh.client.platform: "web"`，Host 半侧依赖 `dsh-host-webserver` 提供的
  `webServer.register` / `webServer.tapIndex` 路由注入能力。

## 桌面端的运行形态（依据本机 DSH 包结构）

DSH 桌面端是 Electron 应用，内部加载同一套 DSH Web 前端（本机 DSH 安装目录里存在
`dsh-host-webserver`、`dsh-web-app`、`dsh-app-boot` 等包）。因此：

| 部分 | Web 端 | 桌面端（推测 / 未实测） |
| --- | --- | --- |
| 设置页「关闭动画」、侧栏退出按钮 | 支持 | 前端同源，**预计可用** |
| 视频播放、结束画面、结束语 | 支持 | 预计可用（渲染进程同浏览器） |
| Host 路由（config / 视频流 / Range 206） | 支持 | 取决于桌面端是否启用 `dsh-host-webserver`；未实测 |
| `window.close()` 关闭窗口 | 普通标签页通常被浏览器拒绝 | Electron 里 `window.close()` 通常能关闭当前窗口，但未实测 |
| Windows `WM_SYSCOMMAND / SC_CLOSE` 关闭助手（`lib/close-window.ps1`） | Windows 上可用 | **不适用**：它按浏览器进程名匹配窗口，DSH 桌面端进程不在白名单里 |
| 「点标签页 × 时播放动画」 | 浏览器不允许 | **Electron 主进程可以拦截 `BrowserWindow` close 事件**，但本插件没有做这层 IPC |

## 为什么没有直接适配桌面端

1. 桌面端没有安装，无法验证 Electron 的 IPC / 窗口生命周期行为；在没测过的情况下写
   「支持桌面端」会误导使用者。
2. 要做真正的「点桌面端窗口 × 时播放关闭动画」，需要在 Electron 主进程的
   `close` 事件里先 `preventDefault()`、播放动画、结束后再 `app.quit()`，这需要 DSH 桌面端
   暴露插件侧 IPC 通道；本插件目前的 Host 半侧只有 HTTP 路由，拿不到这个钩子。
3. 本插件是对 `dsh-startup-screen` 的伴生实现，优先保证 Web 端稳定；桌面端适配作为后续事项。

## 如果你要在桌面端试

- 桌面端同样通过 profile 安装插件（pnpm / npm registry），安装方法见 README「安装」。
- 预期结果：设置页与动画可能出现并可用；「播完自动关闭窗口」可能停在结束画面并提示
  `Ctrl+W`（`window.close()` 若被 Electron 策略拒绝）。这属于未验证行为，不是承诺。
- 反馈时请附：DSH 桌面端版本、操作系统、是否出现设置页、关闭时实际表现。

## 结论

- **Web（浏览器）端：完整支持**，这是本插件的目标平台。
- **桌面端：未验证；不要作为生产依赖**。如果你需要桌面端「点窗口 × 播放动画」，
  建议在桌面端插件里另做一个 Electron 主进程钩子版本，而不是复用本插件的关闭路径。
