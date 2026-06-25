"""Async image downloader with exponential-backoff retries via tenacity."""
import asyncio
import logging
from typing import Optional

import aiohttp
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import MAX_RETRIES, MIN_FILE_BYTES, REQUEST_TIMEOUT

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept":          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://www.google.com/",
}


class ImageDownloader:
    """Async context manager. Use as `async with ImageDownloader() as dl:`."""

    def __init__(self) -> None:
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self) -> "ImageDownloader":
        connector = aiohttp.TCPConnector(limit=20, ssl=False)
        timeout   = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT, connect=10)
        self._session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers=_HEADERS,
        )
        return self

    async def __aexit__(self, *_) -> None:
        if self._session:
            await self._session.close()
            self._session = None

    async def download(self, url: str) -> Optional[bytes]:
        """Return image bytes, or None if the URL is unusable."""
        try:
            return await self._fetch(url)
        except (RetryError, Exception) as exc:
            logger.debug("Download failed for %s: %s", url, exc)
            return None

    # ── Private ────────────────────────────────────────────────────────────────

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=20),
        retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError)),
        reraise=True,
    )
    async def _fetch(self, url: str) -> Optional[bytes]:
        assert self._session, "Must be used inside 'async with ImageDownloader()'"

        async with self._session.get(url, allow_redirects=True) as resp:
            if resp.status != 200:
                logger.debug("HTTP %d: %s", resp.status, url)
                return None

            ct = resp.headers.get("Content-Type", "")
            if "image/" not in ct and "octet-stream" not in ct:
                logger.debug("Non-image content-type %r: %s", ct, url)
                return None

            data = await resp.read()
            if len(data) < MIN_FILE_BYTES:
                logger.debug("File too small (%d bytes): %s", len(data), url)
                return None

            return data
