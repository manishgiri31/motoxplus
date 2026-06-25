from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
OUTPUT_DIR    = Path("images")
LOGS_DIR      = Path("logs")
PROGRESS_FILE = Path("progress.json")
FAILED_LOG    = LOGS_DIR / "failed.csv"

# ── Image output ───────────────────────────────────────────────────────────────
IMAGE_SIZE         = (1000, 1000)
JPEG_QUALITY       = 90
MIN_IMAGE_DIM      = 300    # pixels — reject anything smaller
MAX_ASPECT_RATIO   = 5.0    # width/height — reject banners / ads

# ── Network ────────────────────────────────────────────────────────────────────
REQUEST_TIMEOUT    = 30     # seconds per HTTP request
MAX_RETRIES        = 3
MIN_FILE_BYTES     = 2_048  # skip files < 2 KB (pixels trackers, 1×1 GIFs …)

# ── Search behaviour ───────────────────────────────────────────────────────────
MAX_URLS_TO_TRY    = 6      # try at most this many URLs per product
SEARCH_DELAY_MIN   = 2.0    # seconds — random delay between searches
SEARCH_DELAY_MAX   = 5.0

# ── Watermarked / stock-photo domains to skip ──────────────────────────────────
BLOCKED_DOMAINS: frozenset[str] = frozenset([
    "shutterstock.com",
    "gettyimages.com",
    "istockphoto.com",
    "dreamstime.com",
    "alamy.com",
    "depositphotos.com",
    "123rf.com",
    "vectorstock.com",
    "freepik.com",
    "stock.adobe.com",
    "bigstockphoto.com",
    "canstockphoto.com",
    "clipart-library.com",
])
