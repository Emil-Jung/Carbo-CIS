"""CIS version — X.Y.Z = CIS . Module . Internal.

X (CIS)      : major platform releases / new capability (e.g. the Traceability module).
Y (Module)   : a module changed, or a new module was added.
Z (Internal) : our internal fixes and tweaks ("for us").

Bump the highest part that applies and reset the ones to its right.
See VERSIONING.md for the rules and examples.
"""

CIS_MAJOR = 1      # X — CIS version
CIS_MODULE = 4     # Y — Traceability hub + bag labels
CIS_INTERNAL = 1   # Z — blue tab on the left (outside) as loaded

CIS_VERSION = f"{CIS_MAJOR}.{CIS_MODULE}.{CIS_INTERNAL}"
