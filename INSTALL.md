# 安装 / 升级 / 卸载

> 本仓库当前 **暂不发布**：没有 Release，也没有 npm 包。安装只能从源码目录或本地 `npm pack` 出来的
> tgz 进行。等打磨完、正式发布后会更新本文。

## 前置

- DSH 0.2.x，使用 **web** profile（`dsh web`）。
- 已装 `dsh-startup-screen`（可选，但两个一起才是「开启动画 + 关闭动画」完整形态）。

## 从本地 tgz 安装（推荐）

```bash
cd dsh-shutdown-screen
npm pack                       # 生成 dsh-shutdown-screen-0.2.1.tgz

# 方式 A：PATH 里的 dsh 可用
dsh plugin --profile web add ./dsh-shutdown-screen-0.2.1.tgz

# 方式 B：直接用 DSH 的入口
node "$(npm root -g)/@deepseek-ai/dsh/lib/bin.js" plugin --profile web add ./dsh-shutdown-screen-0.2.1.tgz
```

装完重启 DSH Web 进程，刷新 `http://127.0.0.1:3080`。

## 从源码目录安装（开发）

```bash
dsh plugin --profile web add /path/to/dsh-shutdown-screen
```

插件没有构建步骤（原生 ESM + IIFE），改了 `lib/*.js` 只需要刷新浏览器；Host 半侧（`lib/index.js`）
改了要重启 DSH Web 进程。

## 放视频

```text
~/.dsh/dsh-shutdown/closing.mp4          # Windows: C:\Users\<你>\.dsh\dsh-shutdown\closing.mp4
```

设置页「视频」组里可以「复制媒体目录」和「刷新列表」，然后下拉选择任意 `mp4 / webm / m4v`。

## 升级

1. 用新 tgz 再执行一次 `add`（同名包会覆盖安装）；
2. 重启 DSH Web；
3. 设置保存在 `~/.dsh/dsh-shutdown.json`，升级不会清空；新增字段缺省时自动取默认值。

## 卸载

```bash
dsh plugin --profile web remove dsh-shutdown-screen
```

配置和媒体文件不会自动删除；要彻底清掉：

```bash
rm -rf ~/.dsh/dsh-shutdown ~/.dsh/dsh-shutdown.json     # Windows 用资源管理器或 Remove-Item
```

## 常见问题

**侧栏没有电源按钮 / 设置页没有「关闭动画」**
先确认插件已装进当前 profile：`dsh plugin --profile web why dsh-shutdown-screen`；
再确认刷新的是同一个端口；Host 半侧改动后要重启进程。

**点了退出没有关掉标签页**
浏览器只允许脚本关闭「由脚本打开的窗口」，普通标签页关不掉。这是规范限制，结束页会提示 `Ctrl + W`。

**视频不播 / 黑屏**
确认文件在 `~/.dsh/dsh-shutdown/` 下且扩展名在白名单内；打开设置页「视频」组看「当前视频」是否「已就绪」；
也可以直接访问 `http://127.0.0.1:3080/dsh-shutdown/config` 看 `video.exists`。

**启动动画期间按快捷键没反应**
设计如此：启动动画还在跑时会跳过触发，避免两个全屏层叠在一起。
