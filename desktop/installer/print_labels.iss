; Inno Setup — Carbo Print Labels only (no full CIS shell).
; Build: ISCC.exe /DAppVer=1.6.4 installer\print_labels.iss
; Requires: desktop\dist\Carbo Print Labels\ from BUILD-PRINT-LABELS.cmd

#ifndef AppVer
  #define AppVer "1.6.4"
#endif

#define AppName "Carbo Print Labels"
#define AppExe "Carbo Print Labels.exe"
#define AppPublisher "Carbo"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}}
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Carbo CIS\Print Labels
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=CarboPrintLabels-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
Source: "..\dist\Carbo Print Labels\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\carbolabels"; ValueType: string; ValueName: ""; ValueData: "URL:Carbo Print Labels"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\carbolabels"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\carbolabels\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"
Root: HKCU; Subkey: "Software\Classes\carbolabels\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""

[Run]
Filename: "{app}\{#AppExe}"; Description: "Launch Carbo Print Labels"; Flags: nowait postinstall skipifsilent
