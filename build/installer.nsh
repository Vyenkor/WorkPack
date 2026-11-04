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
    ${If} $WorkPackDesktopShortcut == "0"
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${EndIf}
  !macroend
!endif
