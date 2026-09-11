"""CIS version — X.Y.Z = CIS . Module . Internal.

X (CIS)      : major platform releases / new capability (e.g. the Traceability module).
Y (Module)   : a module changed, or a new module was added.
Z (Internal) : our internal fixes and tweaks ("for us").

Bump the highest part that applies and reset the ones to its right.
See VERSIONING.md for the rules and examples.
"""

CIS_MAJOR = 1      # X — CIS version
CIS_MODULE = 5     # Y — Print Labels USB + layout
CIS_INTERNAL = 1   # Z — ZT231 54×25 mm ZPL spec + test label

CIS_VERSION = f"{CIS_MAJOR}.{CIS_MODULE}.{CIS_INTERNAL}"
