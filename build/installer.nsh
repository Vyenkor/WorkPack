; 安装向导在选择安装位置之后增加“附加任务”页，让用户决定是否创建桌面快捷方式。
; electron-builder 先按默认规则创建快捷方式，用户取消勾选时在 customInstall 中删除。
; 静默安装（/S）不显示该页，默认创建；可加 --no-desktop-shortcut 跳过。
!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh

  Var WorkPackDesktopShortcut
  Var WorkPackDesktopShortcutCheckbox

  !macro customPageAfterChangeDir
    Page custom WorkPackShortcutPageCreate WorkPackShortcutPageLeave

    Function WorkPackShortcutPageCreate
      ${If} ${isUpdated}
        Abort
      ${EndIf}
      !insertmacro MUI_HEADER_TEXT "附加任务" "选择安装 WorkPack 时要一并完成的任务。"
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}
      ${NSD_CreateLabel} 0 0 100% 24u "安装程序会在开始菜单中创建 WorkPack 快捷方式。以后可以在 Windows 设置的“应用”中卸载 WorkPack。"
      Pop $0
      ${NSD_CreateCheckbox} 0 32u 100% 12u "创建桌面快捷方式(&D)"
      Pop $WorkPackDesktopShortcutCheckbox
      ${If} $WorkPackDesktopShortcut != "0"
        ${NSD_Check} $WorkPackDesktopShortcutCheckbox
      ${EndIf}
      nsDialogs::Show
    FunctionEnd

    Function WorkPackShortcutPageLeave
      ${NSD_GetState} $WorkPackDesktopShortcutCheckbox $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $WorkPackDesktopShortcut "1"
      ${Else}
        StrCpy $WorkPackDesktopShortcut "0"
      ${EndIf}
    FunctionEnd
  !macroend

  !macro customInstall
    ; electron-builder 只把安装位置写在自己的注册表项里，这里补到卸载登记，供“应用”和其他工具读取。
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
    ${If} $WorkPackDesktopShortcut == "0"
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${EndIf}
  !macroend
!endif

; 卸载完成后，如果安装目录的上一级已经空了（例如自选的 C:\测试 安装\WorkPack），一并删除。
; RMDir 不带 /r，只删空目录；升级时不删，系统共用的程序目录也不删。
; 放在 customHeader 里，是因为本文件被引入时 LogicLib 和 isUpdated 还没有定义。
!ifdef BUILD_UNINSTALLER
  ; 为所有用户安装时 $APPDATA 指向公共目录，而 userData 在发起卸载的用户的 Roaming 目录。
  ; 与 electron-builder 自带清理一致：读写前切到当前用户，结束后恢复。
  !macro WorkPackUseUserAppData
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
  !macroend
  !macro WorkPackRestoreAppData
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  !macroend
!endif
!macro customHeader
  !ifdef BUILD_UNINSTALLER
    Function un.onUninstSuccess
      ${If} ${isUpdated}
        Return
      ${EndIf}
      ; 仅清理默认 userData 中的记录。模板目录、项目目录和自选数据库目录均不递归删除。
      ${IfNot} ${Silent}
      ${AndIf} $WorkPackDeleteWorkspaceData == "1"
        !insertmacro WorkPackUseUserAppData
        Delete "$APPDATA\WorkPack\workpack-v3.sqlite"
        Delete "$APPDATA\WorkPack\workpack-v3.sqlite-wal"
        Delete "$APPDATA\WorkPack\workpack-v3.sqlite-shm"
        Delete "$APPDATA\WorkPack\workpack-v3.sqlite-journal"
        Delete "$APPDATA\WorkPack\storage.json"
        Delete "$APPDATA\WorkPack\workspace.initialized"
        RMDir "$APPDATA\WorkPack"
        !insertmacro WorkPackRestoreAppData
      ${EndIf}
      ${GetParent} "$INSTDIR" $0
      ${If} $0 == ""
      ${OrIf} $0 == "$LOCALAPPDATA\Programs"
      ${OrIf} $0 == "$PROGRAMFILES"
      ${OrIf} $0 == "$PROGRAMFILES64"
        Return
      ${EndIf}
      RMDir "$0"
    FunctionEnd
  Function un.WorkPackDataPageCreate
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "工作空间数据" "卸载 WorkPack 时可以选择清理本机工作空间记录。"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 0 100% 16u "删除工作空间记录（默认不删除）"
    Pop $WorkPackDeleteWorkspaceDataCheckbox
    !insertmacro WorkPackUseUserAppData
    ${NSD_CreateLabel} 0 24u 100% 42u "仅删除 $APPDATA\WorkPack 中的工作空间数据库和设置。项目文件、模板文件和自选位置的数据保留。"
    Pop $0
    !insertmacro WorkPackRestoreAppData
    nsDialogs::Show
  FunctionEnd

  Function un.WorkPackDataPageLeave
    ${NSD_GetState} $WorkPackDeleteWorkspaceDataCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $WorkPackDeleteWorkspaceData "1"
    ${Else}
      StrCpy $WorkPackDeleteWorkspaceData "0"
    ${EndIf}
  FunctionEnd
  !endif
!macroend

!ifdef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  Var WorkPackDeleteWorkspaceData
  Var WorkPackDeleteWorkspaceDataCheckbox

  !macro customUnWelcomePage
    !insertmacro MUI_UNPAGE_WELCOME
    UninstPage custom un.WorkPackDataPageCreate un.WorkPackDataPageLeave
  !macroend


!endif
