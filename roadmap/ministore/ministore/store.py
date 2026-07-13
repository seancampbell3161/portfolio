"""The in-memory key/value store.  (Milestones 3 & 4)

A thin wrapper over a dict today; the interesting part is milestone 4's lazy
expiry — the same trick Redis uses (it also expires keys when you touch them,
not on a timer). Use time.monotonic() for deadlines, never time.time(): the
wall clock can jump backward, a monotonic clock never does.
"""

import time


class Store:
    """An in-memory key/value store with optional per-key expiry."""

    def __init__(self):
        self._data: dict[str, str] = {}
        # TODO M4: track deadlines, e.g.  self._expires: dict[str, float] = {}

    def set(self, key: str, value: str, ttl_seconds: float | None = None) -> str:
        # Store value under key. Returns "OK".
        # TODO M3: put value in self._data, return "OK".
        self._data[key] = value
        return "OK"
        
        # TODO M4: if ttl_seconds is given, record a deadline:
        #          time.monotonic() + ttl_seconds  in self._expires
        #          (and clear any old deadline when ttl_seconds is None).
        

    def get(self, key: str) -> str | None:
        # Return the value, or None if missing/expired.
        # TODO M3: return self._data.get(key).
        return self._data.get(key)
        
        # TODO M4: first check self._expires — if the deadline has passed,
        #          delete the key (lazy expiry) and return None.
        

    def delete(self, key: str) -> int:
        # Delete key. Returns 1 if it existed, else 0.
        # TODO M3: pop from self._data; return 1/0.
        val = self._data.pop(key, 0)

        return 0 if val == 0 else 1
        
        # TODO M4: also drop any deadline for the key.
        
