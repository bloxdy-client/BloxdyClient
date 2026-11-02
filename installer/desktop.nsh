!include "FileFunc.nsh"
!include "LogicLib.nsh"

!macro customInstall
  ; Preserve the clean desktop for users upgrading an older desktop install.
  ; New installations use the normal per-user application directory.
  ${GetParent} "$INSTDIR" $R0
  ${If} "$R0" == "$DESKTOP"
    SetFileAttributes "$INSTDIR" HIDDEN
  ${EndIf}
  ; Updates retain existing shortcuts, including their old icon source. Point
  ; existing Bloxdy links at the installed ICO so Windows uses a fresh path.
  ${If} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\bloxdy-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${EndIf}
  ${If} ${FileExists} "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\bloxdy-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${EndIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
