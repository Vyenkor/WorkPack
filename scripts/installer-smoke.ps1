# 在 Windows 上检查 NSIS 安装包：静默安装到带空格和中文的自定义目录，
# 检查快捷方式、卸载器和“应用和功能”登记，启动已安装的程序，再静默卸载。
param(
  [Parameter(Mandatory = $true)][string]$Installer
)

$ErrorActionPreference = 'Stop'
$Installer = (Resolve-Path $Installer).Path
$root = Join-Path ([IO.Path]::GetTempPath()) 'WorkPack 安装测试'
$installDir = Join-Path $root 'WorkPack 程序'
$exe = Join-Path $installDir 'WorkPack.exe'
$uninstaller = Join-Path $installDir 'Uninstall WorkPack.exe'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WorkPack.lnk'
$startMenuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'WorkPack.lnk'

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw "安装包检查失败：$message" }
  Write-Host "通过：$message"
}

function Get-UninstallEntry {
  Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ItemProperty $_.PSPath } |
    Where-Object { $_.DisplayName -eq 'WorkPack' }
}

function Install-WorkPack([string]$extra) {
  # /D= 必须放在最后且不能加引号，NSIS 会把后面的整段当成路径。
  $arguments = "/S /currentuser $extra /D=$installDir".Replace('  ', ' ')
  $process = Start-Process -FilePath $Installer -ArgumentList $arguments -Wait -PassThru
  Assert-True ($process.ExitCode -eq 0) "安装程序退出码为 0（参数：$arguments）"
}

function Uninstall-WorkPack {
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -Wait -PassThru
  Assert-True ($process.ExitCode -eq 0) '卸载程序退出码为 0'
  # 卸载器会复制到临时目录后再运行，这里等它真正删完。
  $deadline = (Get-Date).AddSeconds(120)
  while ((Test-Path $exe) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
  while ((Get-UninstallEntry) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }
}

if (Test-Path $root) { Remove-Item $root -Recurse -Force }
Remove-Item $desktopLink, $startMenuLink -Force -ErrorAction SilentlyContinue

Write-Host '== 默认安装：创建桌面快捷方式 =='
Install-WorkPack ''
Assert-True (Test-Path $exe) "程序安装到自定义目录 $installDir"
Assert-True (Test-Path $uninstaller) '安装目录中有卸载程序'
Assert-True (Test-Path (Join-Path $installDir 'resources\app.asar.unpacked\node_modules\better-sqlite3\build\Release\better_sqlite3.node')) 'better-sqlite3 原生模块已解包'
Assert-True (Test-Path $desktopLink) '已创建桌面快捷方式'
Assert-True (Test-Path $startMenuLink) '已创建开始菜单快捷方式'
$entry = Get-UninstallEntry
Assert-True ($null -ne $entry) '已登记到“应用和功能”'
Assert-True ($entry.UninstallString -like "*$installDir*") '卸载命令指向安装目录'

Write-Host '== 启动已安装的程序 =='
$env:WORKPACK_INSTALLED_EXE = $exe
npx playwright test tests/installed-app.spec.ts
if ($LASTEXITCODE -ne 0) { throw '安装包检查失败：已安装的程序未通过启动检查' }
Remove-Item Env:WORKPACK_INSTALLED_EXE

Write-Host '== 卸载 =='
Uninstall-WorkPack
Assert-True (-not (Test-Path $exe)) '卸载后程序文件已删除'
Assert-True (-not (Test-Path $desktopLink)) '卸载后桌面快捷方式已删除'
Assert-True (-not (Test-Path $startMenuLink)) '卸载后开始菜单快捷方式已删除'
Assert-True ($null -eq (Get-UninstallEntry)) '卸载后已从“应用和功能”移除'

Write-Host '== 不创建桌面快捷方式 =='
Install-WorkPack '--no-desktop-shortcut'
Assert-True (Test-Path $exe) '程序已安装'
Assert-True (-not (Test-Path $desktopLink)) '未创建桌面快捷方式'
Assert-True (Test-Path $startMenuLink) '仍创建开始菜单快捷方式'
Uninstall-WorkPack
Assert-True (-not (Test-Path $exe)) '卸载后程序文件已删除'

Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
Write-Host '安装包检查全部通过'
