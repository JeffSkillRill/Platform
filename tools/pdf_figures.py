#!/usr/bin/env python3
"""
Extract question figures from a (watermarked) SAT PDF and upload them to
Supabase Storage, so the bulk importer can reference real image URLs.

Text extraction is the easy half of moving a PDF into the platform —
figures are what turns a 20-minute import into an afternoon. This script
handles the figure half:

    1. detect  — report what the PDF contains, including any watermark
    2. extract — crop each figure to PNG and write a manifest
    3. upload  — push the PNGs to the question-images bucket and record
                 the public URLs in the manifest

Typical run:

    python3 tools/pdf_figures.py detect  questions.pdf
    python3 tools/pdf_figures.py extract questions.pdf --out figures/ --strip-watermark
    python3 tools/pdf_figures.py upload  figures/ --prefix practice-test-b

Upload needs credentials in the environment. The service role key must
never reach the browser, which is exactly why this runs locally:

    export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=...

Requires PyMuPDF:  pip install pymupdf
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - environment guard
    sys.exit("PyMuPDF is required. Install it with:  pip install pymupdf")


BUCKET = "question-images"

# Redaction options that take out text and nothing else. The line-art
# constant was renamed across PyMuPDF releases, so resolve it by name and
# fall back to leaving graphics untouched by omission.
REDACT_TEXT_ONLY = {"images": fitz.PDF_REDACT_IMAGE_NONE}
for _name in ("PDF_REDACT_LINE_ART_NONE", "PDF_REDACT_GRAPHICS_NONE"):
    if hasattr(fitz, _name):
        REDACT_TEXT_ONLY["graphics"] = getattr(fitz, _name)
        break

# A mark that shows up on at least this share of pages is furniture
# (watermark, header rule, logo), not question content.
REPEAT_RATIO = 0.6

# Ignore specks: rules, bullet glyphs, underlines, stray hairlines.
MIN_FIGURE_PT = 40.0

# Vector charts arrive as dozens of separate strokes. Rects closer than
# this are treated as one figure.
CLUSTER_GAP_PT = 14.0

# Anything larger than this share of the page is the page itself —
# a background box or the watermark, not a figure.
MAX_PAGE_AREA_RATIO = 0.55


# ----------------------------------------------------------------------
# geometry helpers
# ----------------------------------------------------------------------

def rect_area(rect):
    return max(0.0, rect.width) * max(0.0, rect.height)


def expand(rect, pad):
    return fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad)


def cluster_rects(rects, gap=CLUSTER_GAP_PT):
    """Merge rects that touch or nearly touch into single figure boxes."""
    boxes = [fitz.Rect(r) for r in rects if rect_area(r) > 0]
    merged = True
    while merged:
        merged = False
        out = []
        while boxes:
            current = boxes.pop()
            hits = []
            rest = []
            for other in boxes:
                if expand(current, gap).intersects(expand(other, gap)):
                    hits.append(other)
                else:
                    rest.append(other)
            if hits:
                merged = True
                for other in hits:
                    current = current | other
            out.append(current)
            boxes = rest
        boxes = out
    return boxes


# ----------------------------------------------------------------------
# watermark detection
# ----------------------------------------------------------------------

def find_watermark(doc):
    """
    Identify repeated page furniture.

    Returns {"images": [xref, ...], "texts": [str, ...]}. Detection is by
    repetition across pages rather than by appearance, so it works for
    both the faint diagonal kind and the opaque stamped kind.
    """
    page_count = len(doc)
    threshold = max(2, int(page_count * REPEAT_RATIO))

    image_pages = defaultdict(set)
    text_counter = Counter()

    for number, page in enumerate(doc):
        for info in page.get_images(full=True):
            image_pages[info[0]].add(number)

        seen_on_page = set()
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    # Watermarks are short labels. Anything long enough to
                    # be a sentence is question content that happens to
                    # recur (instructions, section headers).
                    if 2 <= len(text) <= 40:
                        seen_on_page.add(text)
        text_counter.update(seen_on_page)

    return {
        "images": [xref for xref, pages in image_pages.items() if len(pages) >= threshold],
        "texts": [text for text, count in text_counter.items() if count >= threshold],
    }


def strip_watermark_images(doc, xrefs):
    """
    Blank out repeated raster marks by swapping them for a transparent
    pixel. Safe: it never touches the page content stream, so question
    text and figures are unaffected.
    """
    if not xrefs:
        return 0
    blank = fitz.Pixmap(fitz.csGRAY, fitz.IRect(0, 0, 1, 1), 1)
    blank.clear_with(255)
    replaced = 0
    for page in doc:
        page_xrefs = {info[0] for info in page.get_images(full=True)}
        for xref in xrefs:
            if xref in page_xrefs:
                try:
                    page.replace_image(xref, pixmap=blank)
                    replaced += 1
                except Exception:
                    # Some producers share one xref across pages; a failed
                    # swap costs a slightly dirtier crop, not a bad import.
                    pass
    return replaced


def strip_watermark_text(doc, texts):
    """
    Remove repeated text marks via redaction.

    Text-only: graphics and images are left alone. Still opt-in, because
    a watermark span that overlaps a question would take that text with
    it — always eyeball the crops afterwards.
    """
    if not texts:
        return 0
    removed = 0
    for page in doc:
        hits = []
        for text in texts:
            hits.extend(page.search_for(text))
        if not hits:
            continue
        for rect in hits:
            page.add_redact_annot(rect)
        page.apply_redactions(**REDACT_TEXT_ONLY)
        removed += len(hits)
    return removed


# ----------------------------------------------------------------------
# figure extraction
# ----------------------------------------------------------------------

def figure_rects(page, skip_xrefs):
    """Candidate figure boxes on one page: raster images + vector clusters."""
    page_area = rect_area(page.rect)
    candidates = []

    for info in page.get_images(full=True):
        xref = info[0]
        if xref in skip_xrefs:
            continue
        for rect in page.get_image_rects(xref):
            candidates.append(fitz.Rect(rect))

    vectors = []
    for drawing in page.get_drawings():
        rect = fitz.Rect(drawing["rect"])
        if rect_area(rect) <= 0:
            continue
        # Full-width hairlines are dividers and section rules.
        if rect.height < 3 and rect.width > page.rect.width * 0.5:
            continue
        vectors.append(rect)
    candidates.extend(cluster_rects(vectors))

    keep = []
    for rect in cluster_rects(candidates):
        rect = rect & page.rect
        if rect.width < MIN_FIGURE_PT or rect.height < MIN_FIGURE_PT:
            continue
        if rect_area(rect) > page_area * MAX_PAGE_AREA_RATIO:
            continue
        keep.append(rect)

    # Reading order, so figure numbering follows question numbering.
    keep.sort(key=lambda r: (round(r.y0, 1), round(r.x0, 1)))
    return keep


def parse_pages(spec, total):
    if not spec:
        return list(range(total))
    wanted = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            wanted.update(range(int(start) - 1, int(end)))
        else:
            wanted.add(int(part) - 1)
    return sorted(n for n in wanted if 0 <= n < total)


def cmd_detect(args):
    doc = fitz.open(args.pdf)
    marks = find_watermark(doc)
    pages = parse_pages(args.pages, len(doc))

    print(f"{args.pdf}: {len(doc)} pages, scanning {len(pages)}")
    if marks["images"]:
        print(f"  repeated image marks: {len(marks['images'])} (xrefs {marks['images'][:8]})")
    if marks["texts"]:
        preview = ", ".join(repr(t) for t in marks["texts"][:6])
        print(f"  repeated text marks:  {preview}")
    if not marks["images"] and not marks["texts"]:
        print("  no watermark detected")

    skip = set(marks["images"])
    total = 0
    for number in pages:
        found = figure_rects(doc[number], skip)
        total += len(found)
        if found:
            sizes = ", ".join(f"{int(r.width)}x{int(r.height)}" for r in found)
            print(f"  page {number + 1}: {len(found)} figure(s) — {sizes}")
    print(f"  {total} figure(s) total")
    doc.close()


def cmd_extract(args):
    doc = fitz.open(args.pdf)
    marks = find_watermark(doc)

    if args.strip_watermark:
        count = strip_watermark_images(doc, marks["images"])
        print(f"blanked {count} raster watermark placement(s)")
    if args.strip_watermark_text:
        count = strip_watermark_text(doc, marks["texts"])
        print(f"redacted {count} watermark text placement(s)")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    skip = set(marks["images"])
    zoom = args.dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    manifest = []

    for number in parse_pages(args.pages, len(doc)):
        page = doc[number]
        for index, rect in enumerate(figure_rects(page, skip), start=1):
            # A little bleed so axis labels and tick text survive the crop.
            crop = (expand(rect, args.padding) & page.rect)
            name = f"p{number + 1:03d}-fig{index}.png"
            pixmap = page.get_pixmap(matrix=matrix, clip=crop, alpha=False)
            pixmap.save(out_dir / name)
            manifest.append({
                "file": name,
                "page": number + 1,
                "index": index,
                "bbox": [round(v, 1) for v in (crop.x0, crop.y0, crop.x1, crop.y1)],
                "width": pixmap.width,
                "height": pixmap.height,
                "url": None,
            })

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    doc.close()

    print(f"wrote {len(manifest)} figure(s) to {out_dir}/")
    print(f"manifest: {manifest_path}")
    if manifest:
        print("Check the crops, delete any that are not real figures, then run `upload`.")


# ----------------------------------------------------------------------
# upload
# ----------------------------------------------------------------------

def upload_file(base_url, key, path, local_path, content_type="image/png"):
    endpoint = f"{base_url}/storage/v1/object/{BUCKET}/{path}"
    request = urllib.request.Request(
        endpoint,
        data=local_path.read_bytes(),
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": content_type,
            # Re-running after a partial upload should overwrite rather
            # than fail on every already-uploaded file.
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(request) as response:
        response.read()
    return f"{base_url}/storage/v1/object/public/{BUCKET}/{path}"


def cmd_upload(args):
    base_url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base_url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first.")

    out_dir = Path(args.dir)
    manifest_path = out_dir / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"No manifest at {manifest_path}. Run `extract` first.")

    manifest = json.loads(manifest_path.read_text())
    prefix = args.prefix.strip("/")
    uploaded = 0
    failed = 0

    for entry in manifest:
        local_path = out_dir / entry["file"]
        if not local_path.exists():
            # Deleted during review — a false positive the human rejected.
            entry["url"] = None
            continue
        if entry.get("url") and not args.force:
            continue
        remote = f"{prefix}/{entry['file']}" if prefix else entry["file"]
        try:
            entry["url"] = upload_file(base_url, key, remote, local_path)
            uploaded += 1
            print(f"  {entry['file']} -> {entry['url']}")
        except urllib.error.HTTPError as err:
            failed += 1
            print(f"  {entry['file']} FAILED {err.code} {err.reason}", file=sys.stderr)
        except urllib.error.URLError as err:
            failed += 1
            print(f"  {entry['file']} FAILED {err.reason}", file=sys.stderr)

    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"uploaded {uploaded} file(s), {failed} failure(s)")
    print(f"URLs recorded in {manifest_path} — paste them into the `image_url` field of your import JSON.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_detect = sub.add_parser("detect", help="report watermark and figure candidates without writing files")
    p_detect.add_argument("pdf")
    p_detect.add_argument("--pages", help="page range, e.g. 1-20 or 3,7,9")
    p_detect.set_defaults(func=cmd_detect)

    p_extract = sub.add_parser("extract", help="crop figures to PNG and write a manifest")
    p_extract.add_argument("pdf")
    p_extract.add_argument("--out", default="figures", help="output directory (default: figures)")
    p_extract.add_argument("--pages", help="page range, e.g. 1-20 or 3,7,9")
    p_extract.add_argument("--dpi", type=int, default=200, help="render resolution (default: 200)")
    p_extract.add_argument("--padding", type=float, default=6.0, help="crop bleed in points (default: 6)")
    p_extract.add_argument("--strip-watermark", action="store_true", help="blank repeated raster watermarks (safe)")
    p_extract.add_argument("--strip-watermark-text", action="store_true", help="redact repeated text watermarks (may clip overlapping question text)")
    p_extract.set_defaults(func=cmd_extract)

    p_upload = sub.add_parser("upload", help="upload cropped figures to Supabase Storage")
    p_upload.add_argument("dir", help="directory produced by `extract`")
    p_upload.add_argument("--prefix", default="", help="path prefix inside the bucket, e.g. practice-test-b")
    p_upload.add_argument("--force", action="store_true", help="re-upload entries that already have a URL")
    p_upload.set_defaults(func=cmd_upload)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
