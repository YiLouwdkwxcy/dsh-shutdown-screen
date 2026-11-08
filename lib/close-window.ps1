# dsh-shutdown-screen —— 模拟“点一下浏览器窗口的关闭按钮”
#
# 浏览器不允许网页关掉用户手动打开的标签页（window.close() 会被静默拒绝）。
# 所以退一步：让同一台 Windows 上的 Host 进程调用 user32 的
# WM_SYSCOMMAND / SC_CLOSE，这等价于用鼠标点窗口右上角的 X。
#
# 只对浏览器进程的主窗口生效，优先匹配标题里包含当前 DSH 页面标题的窗口，
# 匹配不到时退回任意一个可见的浏览器主窗口。退出码 0 表示已投递关闭消息。
param([string]$Title = '')

$ErrorActionPreference = 'Stop'

Add-Type -Namespace DshShutdown -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
'@

$browserNames = @(
  'msedge', 'chrome', 'firefox', 'brave', 'vivaldi', 'opera', 'chromium',
  'thorium', 'yandex', 'arc', 'safari', 'librewolf', 'waterfox'
)

$procs = @(Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $browserNames -contains $_.ProcessName.ToLower() })

if (-not $procs) {
  Write-Output 'error:no-browser-window'
  exit 2
}

$hit = $null
if ($Title) {
  $hit = $procs |
    Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($Title, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
    Select-Object -First 1
}
if (-not $hit) {
  $hit = $procs | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
}
if (-not $hit) {
  Write-Output 'error:no-window-title'
  exit 3
}

$WM_SYSCOMMAND = 0x0112
$SC_CLOSE = 0xF060
[DshShutdown.Win]::PostMessage($hit.MainWindowHandle, $WM_SYSCOMMAND, [IntPtr]::new($SC_CLOSE), [IntPtr]::Zero) | Out-Null

Write-Output ("ok:{0}:{1}:{2}" -f $hit.ProcessName, $hit.Id, $hit.MainWindowTitle)
exit 0
