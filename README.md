# dsh-shutdown-screen · 关闭动画

给 DeepSeek Harness（DSH）Web 界面加一段 **退出动画**：点侧栏底部的电源按钮（或按快捷键）时，
全屏播放你指定的视频，播完尝试关闭标签页。它是 [dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen)
的伴生插件——开启动画归它管，关闭动画归本插件管，两者各有独立设置页，可同时启用。

> **状态：暂不发布，仍需打磨。**
> 这个仓库是公开的，但**没有任何发布包**（没有 Release、没有 npm 版本），因此暂时不能通过
> `dsh plugin add dsh-shutdown-screen` 直接下载安装。请按下面的「安装」一节从源码/本地打包安装。

> **关于这个插件**
> 本插件由 AI 编写，源自我的一个小想法：给 DSH 的「开启动画」补上对应的「关闭动画」。
> 它更像一次尝试和玩票，不是长期维护的项目，**后面可能就会废弃**。如果你只是觉得有意思，
> 可以随意取用、修改；不建议把它当作可靠的长期依赖。

---

## 这是什么

DSH 启动时会播「开启动画」；这个插件补上另一半：**退出时播放一段视频**。

- 触发方式一：侧栏底部、设置按钮上方的 **电源按钮**。
- 触发方式二：快捷键，默认 `Alt + Shift + Q`（可在设置页改）。
- 播放内容：`~/.dsh/dsh-shutdown/closing.mp4`（也可换成同目录下任意 mp4 / webm / m4v）。
- 播放结束：尝试 `window.close()` 关闭标签页；浏览器不允许时停在结束卡片，提示用 `Ctrl + W`。
- 设置页新增两项：「关闭动画」整页设置 + 侧栏退出按钮；「启动动画」仍是原插件自己的页面。

> 为什么不能用标签页右上角的 × 触发？
> 浏览器安全模型不允许网页在标签页被关闭时执行动画：`beforeunload` 只能弹原生确认框，
> `pagehide` / `unload` 阶段已经无法渲染新内容。所以「退出动画」必须由一个应用内入口触发。

---

## 功能

- **视频即动画**：直接播放原始视频，不做重编码；服务端实现了 HTTP Range（206），拖进度条、分段加载都正常。
- **可换视频**：媒体目录里的任意 `mp4 / webm / m4v` 都能在设置页下拉选择，支持「刷新列表」。
- **播放区间**：可从第 N 秒开始、播到第 M 秒结束；倍速 0.35×–3×。
- **触发控制**：侧栏按钮可关；快捷键可改（必须带修饰键，避免误触）；退出前可二次确认。
- **播放时机**：每次 / 每个浏览器会话一次 / 每天一次。
- **结束动作**：尝试关闭标签页 / 停在结束页 / 重新进入 DSH。
- **音画与文案**：视频音量、结束语 TTS（中文 / 英文 / 中英各一遍，可选系统音色、语速、音高、音量、
  提示音、延后毫秒）、合成器关机音效、主题（深/浅）、强调色与故障色、身份资料、品牌与文案、页脚。
- **不干扰开启动画**：启动动画正在播放时不会触发；关闭动画的层级（`z-index: 2147483600`）高于开启动画，
  退出时一定盖在最上面。
- **更新安全**：不修改 `dsh-startup-screen` 的任何文件，原插件可以照常更新。

---

## 安装

需要 DSH 0.2.x（Web profile）。在插件源码目录里：

```bash
# 1) 打包
npm pack
# 得到 dsh-shutdown-screen-0.1.0.tgz

# 2) 安装到 web profile
node "$(npm root -g)/@deepseek-ai/dsh/lib/bin.js" plugin --profile web add ./dsh-shutdown-screen-0.1.0.tgz
```

（`dsh` 命令本身是同一个入口；如果 PATH 里的 `dsh` 能用，直接 `dsh plugin --profile web add ...` 即可。）

也可以直接从目录安装（开发时更方便，改完文件刷新页面就生效）：

```bash
dsh plugin --profile web add /path/to/dsh-shutdown-screen
```

装好后重启 DSH Web（或按你的启动方式刷新），刷新 `http://127.0.0.1:3080`：

- 设置页左侧多出 **关闭动画**；
- 侧栏底部、设置按钮上方多出 **电源按钮**；
- 全局快捷键 `Alt + Shift + Q` 可用。

## 放视频

```text
Windows: C:\Users\<你>\.dsh\dsh-shutdown\closing.mp4
macOS / Linux: ~/.dsh/dsh-shutdown/closing.mp4
```

- 设置页「视频」组里有「复制媒体目录」和「刷新列表」按钮；也可以把别的视频放进去再选。
- 视频文件不会进 Git（仓库 `.gitignore` 忽略媒体文件），也不会上传到任何服务器——只由本机的
  DSH Web 服务读取。
- 仓库不附带示例视频；请使用你有权使用的内容。

## 使用

1. 点侧栏底部电源按钮，或按 `Alt + Shift + Q`。
2. 若开了「退出前二次确认」，先确认。
3. 全屏播放视频；可点右上角 `SKIP` 或按 `Esc` 跳过（若允许跳过）。
4. 播完出现结束卡片；按设置尝试关闭标签页 / 停留 / 重新进入。
5. 想先看效果：设置页「立即预览」——预览不会真的关页。

---

## 设置页

「关闭动画」页面共 8 组，其中 6 组与原「启动动画」的 33 项一一对应（字段名、含义、默认值都相同），
另外新增视频与触发两组：

| 组 | 内容 |
| --- | --- |
| 播放 | 启用、播放时机、倍速 |
| 视频（新增） | 视频文件、画面适配（contain/cover）、开始秒、结束秒、媒体目录、立即预览 |
| 触发与结束（新增） | 侧栏退出按钮、退出快捷键、播放结束后动作 |
| 交互 | 退出前二次确认、允许跳过 |
| 声音 / 语音 / 音效 | 视频声音、音量、TTS 开关/语言/音色/语速/音高/音量/提示音、音效、TTS 延后 |
| 视觉 | 主题、角标与进度条、强调色、故障色 A/B |
| 身份资料 | 身份名称、身份编号、权限等级 |
| 品牌与文案 | 品牌 3 行、机构名中英、副标题、结束框文案、页脚 |

配置保存在 `~/.dsh/dsh-shutdown.json`（原子写入，损坏时自动回落默认值）。

---

## 它是怎么实现的

```text
DSH Web 进程（Host 半侧，lib/index.js）
  ├─ register 5 条路由：
  │    /dsh-shutdown/config      GET 读配置 / POST 写配置（归一化、reset）
  │    /dsh-shutdown/closing.js  关闭动画运行时（IIFE，按 mtime 缓存）
  │    /dsh-shutdown/closing.css 样式（按 mtime 缓存）
  │    /dsh-shutdown/media       媒体目录列表
  │    /dsh-shutdown/video       视频流，支持 Range 206 / HEAD
  ├─ tapIndex：往 index.html 注入 <link> + critical CSS + 内联配置 + <script defer closing.js>
  └─ 所有路由先过 connection.requestRejection（DNS 重绑定防护，和原插件一致）

浏览器（Client 半侧，lib/client.js）
  ├─ settings.section  → 设置页「关闭动画」（order 27，原插件是 26）
  ├─ settings.section.icon → 电源图标
  └─ sidebar.footer.action → 侧栏底部电源按钮（order 55）

关闭动画运行时（lib/closing.js）
  ├─ 触发：按钮 / 快捷键 / window 事件 / window.__DSH_SHUTDOWN_API__
  ├─ 播放：<video> + 自定义 chrome（品牌、ID、进度条、SKIP、结束卡片）
  ├─ 结束：TTS 告别语 → 按 endAction 关页 / 停留 / 重载
  └─ 清理：移除节点、解锁滚动、恢复焦点、复位 __DSH_SHUTDOWN_RUNNING__
```

为什么不做成「直接监听关页」：见上文浏览器限制。桌面端（Electron）理论上可以拦截窗口关闭，
但本插件按纯 Web 形态实现，桌面端需要另加 IPC 通道，暂未适配。

安全边界：

- 媒体文件名白名单 + 目录固定，配置里的路径穿越会被归一化回默认值；
- 内联配置对 `<` 做 `\u003c` 转义，避免 `</script>` 逃逸；
- 配置里有 `shortcut` 字符串，但只在运行时比较 `KeyboardEvent`，不 `eval`；
- 视频只从本机 `~/.dsh/dsh-shutdown/` 读取，不代理远程 URL。

---

## 测试

```bash
node test/smoke-host.mjs   # 76 项断言：导出形状 / 路由 / 信任栅栏 / 配置归一化 / Range 206 / 注入 / XSS
node --check lib/index.js && node --check lib/closing.js && node --check lib/client.js
```

## 兼容性

- DSH Web profile（`dsh.client.platform: "web"`），DSH 0.2.x；依赖公开的 `webServer`、
  `connection.requestRejection`、`ctx.slots` 接口，不碰 DSH 内部私有实现。
- 与 `dsh-startup-screen` 1.2.0 并存验证；两个插件互不改文件。
- 桌面端：Host 半侧检测不到 `webServer` 时只告警不报错，设置页仍可用；关闭动画需 Web 端。

---

## 致谢

本插件是 **[dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen)** 的伴生插件，
在结构、接口约定和不少实现细节上参考了它。原项目作者 **沈宏宏**，MIT License，仓库：
<https://github.com/6shenhonghong9/dsh-startup-screen>。

如果你喜欢这种「启动 / 关闭」仪式感，请先去原项目点个 Star。

## License

MIT © 2026 YiLouwdkwxcy。详见 [LICENSE](./LICENSE)。
