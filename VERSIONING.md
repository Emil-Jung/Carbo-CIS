# CIS versioning — `X.Y.Z`

The installed Carbo Integrated System uses a three-part version:

```
X . Y . Z
|   |   \- Internal  - our fixes/tweaks ("for us"): bug fixes, wording, styling
|   \----- Module    - a module changed, or a new module was added
\--------- CIS       - major platform release / new capability
```

Set in `desktop/version.py`:

```python
CIS_MAJOR = 1      # X
CIS_MODULE = 0     # Y
CIS_INTERNAL = 0   # Z
```

## Rules

- Bump the **highest** part that applies and **reset the parts to its right to 0**.
- Higher versions always win the update comparison (numeric, left-to-right).

## Examples

| Change                                                   | From    | To      |
|----------------------------------------------------------|---------|---------|
| First release                                            | —       | `1.0.0` |
| Fix a wording/bug in the Consumption module (for us)     | `1.0.0` | `1.0.1` |
| Add fuel trend chart to the Consumption module           | `1.0.1` | `1.1.0` |
| Add the new **Traceability** module                      | `1.1.0` | `1.2.0` |
| Small internal tweak after adding Traceability           | `1.2.0` | `1.2.1` |
| Major CIS release (new shell, big capability)            | `1.2.1` | `2.0.0` |

## Release checklist

1. Edit `desktop/version.py` (bump the right part).
2. `BUILD-CIS.cmd` -> produces `dist\Carbo Integrated System.exe`.
3. `powershell -File scripts\stage-cis-download.ps1` -> writes `cis_download\version.json` + exe with SHA256.
4. Upload both files to the server's CIS app folder (`/opt/carbo/cis/app/`).
5. Installed apps see the new `version.json` on next launch and offer the update.

## Per-module tracking (optional, later)

Each web module can also carry its own `version` string in its JS file for finer
tracking (surfaced in Help -> About). The installed app's `X.Y.Z` remains the single
number that drives auto-update; per-module versions are informational.
