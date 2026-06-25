#!/usr/bin/env python3
"""
Product image downloader — downloads one image per row from an Excel file.

Columns required in the Excel file: Product Name, Brand, SKU, Vehicle

Usage
-----
    python main.py products.xlsx
    python main.py products.xlsx --output my_images --concurrency 3
    python main.py products.xlsx --verbose
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

from playwright.async_api import BrowserContext, async_playwright
from tqdm import tqdm

import config as cfg
from downloader import ImageDownloader
from excel_handler import ExcelHandler
from processor import ImageProcessor
from scraper import ImageScraper
from tracker import Tracker


# ── CLI ────────────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Download product images from Google Images.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("excel",                          help="Path to the Excel file")
    p.add_argument("--output",      default="images",help="Directory to save images")
    p.add_argument("--concurrency", type=int, default=2,
                   help="Parallel browser tabs (keep ≤ 3 to avoid rate-limits)")
    p.add_argument("--verbose", action="store_true", help="Show debug logs")
    return p


# ── Per-product coroutine ──────────────────────────────────────────────────────

async def _process(
    product: dict,
    page_pool: asyncio.Queue,
    downloader: ImageDownloader,
    processor: ImageProcessor,
    tracker: Tracker,
    output_dir: Path,
) -> tuple[str, bool, str]:
    """Return (sku, success, reason)."""
    sku = product["sku"]

    if tracker.is_done(sku):
        return sku, True, "already done"

    output_path = output_dir / f"{sku}.jpg"
    query = " ".join(
        filter(None, [product["brand"], product["name"], product["vehicle"]])
    )

    # ── Search ────────────────────────────────────────────────────────────────
    page = await page_pool.get()
    try:
        urls = await ImageScraper().search(page, query)
    except Exception as exc:
        reason = f"Search error: {exc}"
        tracker.log_failure(sku, product["name"], reason)
        return sku, False, reason
    finally:
        await page_pool.put(page)  # return page before downloading

    if not urls:
        reason = "No images found on Google Images"
        tracker.log_failure(sku, product["name"], reason)
        return sku, False, reason

    # ── Download + process ────────────────────────────────────────────────────
    for url in urls:
        try:
            data = await downloader.download(url)
            if data is None:
                continue
            # Run CPU-bound image processing in a thread pool
            ok = await asyncio.to_thread(processor.process, data, output_path)
            if ok:
                tracker.mark_done(sku, str(output_path))
                return sku, True, "ok"
        except Exception:
            continue

    reason = "All candidate URLs failed"
    tracker.log_failure(sku, product["name"], reason)
    return sku, False, reason


# ── Async main ─────────────────────────────────────────────────────────────────

async def _run(args: argparse.Namespace) -> int:
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    cfg.LOGS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load Excel ────────────────────────────────────────────────────────────
    try:
        excel = ExcelHandler(args.excel)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    products = excel.read_products()
    if not products:
        print("No products found in the Excel file.")
        return 0

    tracker = Tracker()
    processor = ImageProcessor()

    pending_products = [p for p in products if not tracker.is_done(p["sku"])]
    already_done     = len(products) - len(pending_products)

    print(f"Total products  : {len(products)}")
    print(f"Already done    : {already_done}  (resuming)")
    print(f"To process      : {len(pending_products)}")
    print()

    if not pending_products:
        print("Nothing to do — all products already processed.")
        excel.update_paths(tracker.get_paths())
        return 0

    concurrency = min(args.concurrency, len(pending_products))

    # ── Launch browser ────────────────────────────────────────────────────────
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        # Each page lives in its own context so cookies/sessions are isolated
        page_pool: asyncio.Queue = asyncio.Queue()
        contexts: list[BrowserContext] = []
        for _ in range(concurrency):
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                locale="en-US",
                extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
            )
            await page_pool.put(await ctx.new_page())
            contexts.append(ctx)

        # ── Process products ──────────────────────────────────────────────────
        async with ImageDownloader() as downloader:
            tasks = [
                _process(p, page_pool, downloader, processor, tracker, output_dir)
                for p in pending_products
            ]

            pbar = tqdm(
                total=len(products),
                initial=already_done,
                desc="Images",
                unit="img",
                dynamic_ncols=True,
            )
            succeeded = failed = 0

            for coro in asyncio.as_completed(tasks):
                _, ok, _ = await coro
                if ok:
                    succeeded += 1
                    pbar.set_postfix(ok=succeeded, fail=failed)
                else:
                    failed += 1
                    pbar.set_postfix(ok=succeeded, fail=failed)
                pbar.update(1)

            pbar.close()

        for ctx in contexts:
            await ctx.close()
        await browser.close()

    # ── Write image paths back to Excel ───────────────────────────────────────
    paths = tracker.get_paths()
    if paths:
        excel.update_paths(paths)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\nSucceeded : {succeeded}")
    print(f"Failed    : {failed}")
    print(f"Images    : {output_dir.resolve()}")
    if failed:
        print(f"Fail log  : {cfg.FAILED_LOG.resolve()}")

    return 0 if failed == 0 else 2


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = _build_parser()
    args   = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    sys.exit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
