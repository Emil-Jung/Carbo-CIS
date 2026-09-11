' Launch CIS without a Python console (double-click this file).
Option Explicit

Dim sh, fso, dir, pyw, tmp, f, cmd

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

pyw = dir & "\.venv\Scripts\pythonw.exe"
If Not fso.FileExists(pyw) Then
  tmp = sh.ExpandEnvironmentStrings("%TEMP%") & "\cis_pythonw_path.txt"
  sh.Run "cmd /c where pythonw > """ & tmp & """ 2>nul", 0, True
  If fso.FileExists(tmp) Then
    Set f = fso.OpenTextFile(tmp, 1)
    If Not f.AtEndOfStream Then pyw = Trim(f.ReadLine())
    f.Close
    fso.DeleteFile tmp
  End If
End If

If pyw = "" Or Not fso.FileExists(pyw) Then
  MsgBox "Could not find pythonw.exe." & vbCrLf & vbCrLf & _
    "From desktop\ run:" & vbCrLf & _
    "  python -m venv .venv" & vbCrLf & _
    "  .venv\Scripts\pip install -r requirements.txt", vbCritical, "Carbo Integrated System"
  WScript.Quit 1
End If

sh.CurrentDirectory = dir
cmd = """" & pyw & """ """ & dir & "\app.py"""
' Window style 0 hides only this launcher; pythonw still opens the CIS GUI.
sh.Run cmd, 0, False
