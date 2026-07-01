; Inno Setup script for Carbo Integrated System.
; Build via BUILD-INSTALLER.cmd (passes /DAppVer=X.Y.Z read from version.py),
; or manually:  ISCC.exe /DAppVer=1.0.0 installer\cis.iss
;
; Per-user install (PrivilegesRequired=lowest) so silent auto-updates need no UAC.

#ifndef AppVer
  #define AppVer "0.0.0"
#endif

#define AppName "Carbo Integrated System"
#define AppExe "Carbo Integrated System.exe"
#define AppPublisher "Carbo"

[Setup]
; A stable AppId keeps upgrades in-place. Do not change this GUID between releases.
AppId={{7C2B8D4E-3A6F-4E1B-9C0A-1F5B2E7D9A10}
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Carbo CIS
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=CarboCIS-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; CloseApplications helps replace files if the app is still running.
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
; The PyInstaller one-folder output.
Source: "..\dist\Carbo Integrated System\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Optional: drop the WebView2 evergreen bootstrapper here to auto-install if missing.
Source: "redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: dontcopy skipifsourcedoesntexist

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
; Launch after an interactive install; skipped during silent auto-update (the
; updater relaunches the app itself).
Filename: "{app}\{#AppExe}"; Description: "Launch Carbo Integrated System"; Flags: nowait postinstall skipifsilent

[Code]
function WebView2Installed(): Boolean;
var
  s: string;
begin
  // Evergreen runtime registration (per-machine or per-user).
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', s) or
    RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', s) or
    RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', s);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  tmpPath: string;
  resultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    if not WebView2Installed() then
    begin
      try
        ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
        tmpPath := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
        if FileExists(tmpPath) then
          Exec(tmpPath, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, resultCode);
      except
        // Bootstrapper not bundled — WebView2 is present on Win11 and most Win10;
        // if truly missing the app will prompt to install it on first run.
      end;
    end;
  end;
end;
