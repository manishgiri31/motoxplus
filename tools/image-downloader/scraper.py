"""
Google Images scraper using Playwright.

Primary strategy  : parse the "ou" (original URL) fields from Google's
                    embedded JSON blobs — fast and doesn't require clicking.
Fallback strategy : click each thumbnail and pull the full-res src from
                    the side panel — handles pages where JSON isn't present.
"""
import asyncio
import logging
import random
import re
import urllib.parse

from playwright.async_api import Page

from config import (
    BLOCKED_DOMAINS,
    MAX_URLS_TO_TRY,
    SEARCH_DELAY_MIN,
    SEARCH_DELAY_MAX,
)

logger = logging.getLogger(__name__)

_BLOCKED_RE = re.compile(
    "|".join(re.escape(d) for d in BLOCKED_DOMAINS),
    re.IGNORECASE,
)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _is_blocked(url: str) -> bool:
    return bool(_BLOCKED_RE.search(url))


def _is_thumbnail(url: str) -> bool:
    return "encrypted-tbn" in url or "gstatic.com/images?q=tbn" in url


class ImageScraper:

    async def search(self, page: Page, query: str) -> list[str]:
        """Return up to MAX_URLS_TO_TRY high-res image URLs for *query*."""
        await asyncio.sleep(random.uniform(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX))

        await page.set_extra_http_headers({"Accept-Language": "en-US,en;q=0.9"})

        search_url = (
            "https://www.google.com/search?"
            + urllib.parse.urlencode(
                {"q": query, "tbm": "isch", "hl": "en", "safe": "off"}
            )
        )

        try:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30_000)
        except Exception as exc:
            logger.warning("Navigation failed for %r: %s", query, exc)
            return []

        # Dismiss cookie / consent dialogs that block content
        await self._dismiss_consent(page)

        # Give JS a moment to populate image data
        await page.wait_for_timeout(2_000)

        # ── Strategy 1: extract from embedded JSON ────────────────────────────
        html = await page.content()
        if "unusual traffic" in html.lower():
            logger.warning("Google CAPTCHA detected for query: %r", query)
            return []

        urls = self._extract_from_json(html)
        logger.debug("JSON strategy: %d URLs for %r", len(urls), query)

        # ── Strategy 2: click thumbnails as fallback ──────────────────────────
        if len(urls) < 3:
            fallback = await self._extract_from_thumbnails(page)
            for u in fallback:
                if u not in urls:
                    urls.append(u)
            logger.debug("After fallback: %d URLs for %r", len(urls), query)

        return urls[:MAX_URLS_TO_TRY]

    # ── Private ────────────────────────────────────────────────────────────────

    def _extract_from_json(self, html: str) -> list[str]:
        """Pull "ou" (original URL) values from Google's inline JSON."""
        raw = re.findall(r'"ou":"(https?://[^"]+)"', html)
        seen, result = set(), []
        for url in raw:
            # Unescape common JSON unicode escapes Google uses
            url = (
                url.replace(r"=", "=")
                   .replace(r"&", "&")
                   .replace(r"\/", "/")
            )
            if url in seen:
                continue
            seen.add(url)
            if _is_thumbnail(url) or _is_blocked(url):
                continue
            result.append(url)
        return result

    async def _extract_from_thumbnails(self, page: Page) -> list[str]:
        """Click each thumbnail and grab the full image src from the side panel."""
        urls: list[str] = []

        # Google changes class names frequently — try multiple selectors
        thumb_selectors = [
            'div[jsname="dTDiAc"] g-img img',
            "div[data-q] g-img img",
            "div.isv-r img",
            ".rg_i",
        ]
        thumbnails = []
        for sel in thumb_selectors:
            thumbnails = await page.query_selector_all(sel)
            if thumbnails:
                break

        panel_selectors = [
            'img[jsname="kn3ccd"]',
            'c-wiz.SSPGKf img[src^="https"]',
            'div.tvh9oe img[src^="https"]',
        ]

        for thumb in thumbnails[: MAX_URLS_TO_TRY * 2]:
            if len(urls) >= MAX_URLS_TO_TRY:
                break
            try:
                await thumb.click(timeout=3_000)
                await page.wait_for_timeout(1_200)

                for sel in panel_selectors:
                    el = await page.query_selector(sel)
                    if not el:
                        continue
                    src = await el.get_attribute("src") or ""
                    if (
                        src.startswith("http")
                        and not src.startswith("data:")
                        and not _is_thumbnail(src)
                        and not _is_blocked(src)
                    ):
                        urls.append(src)
                        break
            except Exception:
                continue

        return urls

    async def _dismiss_consent(self, page: Page) -> None:
        for sel in [
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            '[aria-label="Accept all"]',
            'form[action*="consent"] button',
            'button:has-text("Agree")',
        ]:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=1_500):
                    await btn.click()
                    await page.wait_for_timeout(800)
                    return
            except Exception:
                pass
