"""Image processing: validate → convert to RGB → fit on white canvas → save as JPEG."""
import io
import logging
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from config import IMAGE_SIZE, JPEG_QUALITY, MAX_ASPECT_RATIO, MIN_IMAGE_DIM

logger = logging.getLogger(__name__)


class ImageProcessor:

    def process(self, data: bytes, output_path: Path) -> bool:
        """
        Validate and process raw image bytes.

        Returns True on success (file written), False if the image should be
        skipped (too small, extreme aspect ratio, corrupt, etc.).
        """
        try:
            img = Image.open(io.BytesIO(data))
            img.load()  # force full decode — catches truncated files
        except (UnidentifiedImageError, Exception) as exc:
            logger.debug("Cannot open image: %s", exc)
            return False

        w, h = img.size

        if w < MIN_IMAGE_DIM or h < MIN_IMAGE_DIM:
            logger.debug("Rejected — too small: %dx%d", w, h)
            return False

        ratio = max(w, h) / min(w, h)
        if ratio > MAX_ASPECT_RATIO:
            logger.debug("Rejected — extreme aspect ratio %.1f (likely banner/ad)", ratio)
            return False

        img = self._to_rgb(img)
        img = self._fit_on_white(img)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(str(output_path), "JPEG", quality=JPEG_QUALITY, optimize=True)
        logger.debug("Saved %s (%dx%d)", output_path.name, *IMAGE_SIZE)
        return True

    # ── Private ────────────────────────────────────────────────────────────────

    def _to_rgb(self, img: Image.Image) -> Image.Image:
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            return bg
        if img.mode != "RGB":
            return img.convert("RGB")
        return img

    def _fit_on_white(self, img: Image.Image) -> Image.Image:
        """Resize to fit within IMAGE_SIZE (maintain ratio) then center on white canvas."""
        tw, th = IMAGE_SIZE
        img.thumbnail(IMAGE_SIZE, Image.LANCZOS)
        canvas = Image.new("RGB", IMAGE_SIZE, (255, 255, 255))
        x = (tw - img.width)  // 2
        y = (th - img.height) // 2
        canvas.paste(img, (x, y))
        return canvas
