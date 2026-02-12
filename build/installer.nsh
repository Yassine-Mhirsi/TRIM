!macro customInstall
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\TrimWithApp" "" "Trim with Trim"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\TrimWithApp\command" "" '"$INSTDIR\Trim.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mov\shell\TrimWithApp" "" "Trim with Trim"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mov\shell\TrimWithApp\command" "" '"$INSTDIR\Trim.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mkv\shell\TrimWithApp" "" "Trim with Trim"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.mkv\shell\TrimWithApp\command" "" '"$INSTDIR\Trim.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.webm\shell\TrimWithApp" "" "Trim with Trim"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.webm\shell\TrimWithApp\command" "" '"$INSTDIR\Trim.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mp4\shell\TrimWithApp"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mov\shell\TrimWithApp"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.mkv\shell\TrimWithApp"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.webm\shell\TrimWithApp"
!macroend
