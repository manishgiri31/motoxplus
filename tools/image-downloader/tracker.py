import csv
import json
from datetime import datetime
from pathlib import Path

from config import PROGRESS_FILE, FAILED_LOG


class Tracker:
    """Persists progress to JSON (resume support) and logs failures to CSV."""

    def __init__(self) -> None:
        self._done:   dict[str, str] = {}  # sku → image_path
        self._failed: set[str]       = set()
        self._load()

    # ── Public ─────────────────────────────────────────────────────────────────

    def is_done(self, sku: str) -> bool:
        return sku in self._done

    def mark_done(self, sku: str, image_path: str) -> None:
        self._done[sku] = image_path
        self._failed.discard(sku)
        self._flush()

    def log_failure(self, sku: str, name: str, reason: str) -> None:
        self._failed.add(sku)
        self._flush()
        self._append_csv(sku, name, reason)

    def get_paths(self) -> dict[str, str]:
        return dict(self._done)

    @property
    def done_count(self) -> int:
        return len(self._done)

    @property
    def failed_count(self) -> int:
        return len(self._failed)

    # ── Private ────────────────────────────────────────────────────────────────

    def _load(self) -> None:
        if PROGRESS_FILE.exists():
            data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
            self._done   = data.get("done", {})
            self._failed = set(data.get("failed", []))

    def _flush(self) -> None:
        PROGRESS_FILE.write_text(
            json.dumps(
                {"done": self._done, "failed": sorted(self._failed)},
                indent=2,
            ),
            encoding="utf-8",
        )

    def _append_csv(self, sku: str, name: str, reason: str) -> None:
        FAILED_LOG.parent.mkdir(parents=True, exist_ok=True)
        write_header = not FAILED_LOG.exists()
        with open(FAILED_LOG, "a", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            if write_header:
                w.writerow(["SKU", "Product Name", "Reason", "Timestamp"])
            w.writerow([sku, name, reason, datetime.now().isoformat()])
