param(
  [Parameter(Mandatory = $true)]
  [string]$AppExePath
)

$extensions = @(".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v")
$command = '"' + $AppExePath + '" "%1"'

if (-not (Test-Path -Path $AppExePath -PathType Leaf)) {
  throw "App executable not found: $AppExePath"
}

foreach ($ext in $extensions) {
  $shellKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\TrimWithApp"
  $commandKey = "$shellKey\command"

  New-Item -Path $shellKey -Force | Out-Null
  New-ItemProperty -Path $shellKey -Name "(Default)" -Value "Trim with Trim" -PropertyType String -Force | Out-Null

  New-Item -Path $commandKey -Force | Out-Null
  New-ItemProperty -Path $commandKey -Name "(Default)" -Value $command -PropertyType String -Force | Out-Null
}

Write-Host "Context menu entries created in HKCU for supported video formats."
