#!/usr/bin/env python3
"""
Scrapes the ACLA dance directory and outputs a JSON array of dance entries.

For each dance that has an .htm description page, the script also fetches
that page and extracts:
  - Musik   : the tune/track name (e.g. "Lugn hambo") — useful for
              matching against tracks in the dansbart database
  - Danstyp : the dance category (e.g. "Hambo", "Vals") — used for
              auto-categorisation and track suggestions

Usage:
    pip install -r requirements.txt
    python index_acla_dances.py > dances.json
    python index_acla_dances.py --output dances.json [--delay 1.0]

The output JSON can be uploaded via the admin UI at /admin/dances.
"""

import argparse
import json
import sys
import time
from urllib.parse import urljoin

import io

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

ACLA_BASE = "https://www.acla.se/kultisdans/"
ACLA_LIST_URL = f"{ACLA_BASE}alladanser.htm"
HTM_EXTENSIONS = {".htm", ".html"}
PDF_EXTENSIONS = {".pdf"}
REQUEST_TIMEOUT = 10
DEFAULT_DELAY = 1.0


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = "DansbartBot/1.0 (dance directory indexer; info@dansbart.se)"
    return s


def fetch_list(session: requests.Session) -> list[dict]:
    """Fetch the ACLA dance list and return raw entries with name + url."""
    resp = session.get(ACLA_LIST_URL, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding

    soup = BeautifulSoup(resp.text, "html.parser")
    entries = []
    seen_names: set[str] = set()

    for tag in soup.find_all("a"):
        href = (tag.get("href") or "").strip()
        name = " ".join(tag.get_text().split())
        if not name or not href:
            continue
        if href.startswith(("#", "mailto:", "http://www.grfdans", "http://w1.")):
            continue
        if "alladanser" in href or href in ("", "/"):
            continue
        if "youtube.com" in href or "youtu.be" in href:
            continue
        if name.lower() == "video":
            continue

        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)

        url = urljoin(ACLA_BASE, href)
        entries.append({"name": name, "dance_description_url": url})

    return entries


def extract_bold_field_htm(soup: BeautifulSoup, label: str) -> str | None:
    """
    Extract a field value from ACLA .htm pages.

    The pages use a 4-column table where the label sits in col 0 (inside a
    <font><b> wrapper) and the value sits in col 2, with an empty spacer in
    col 1.  We therefore skip empty siblings and return the first non-empty
    sibling <td>.
    """
    for tag in soup.find_all(["b", "strong", "font"]):
        tag_text = tag.get_text(strip=True).rstrip(":").strip()
        if tag_text.lower() != label.lower():
            continue

        parent = tag.parent
        # Walk up one level if the bold tag is nested inside <font>
        if parent and parent.name == "font":
            parent = parent.parent

        if parent and parent.name == "td":
            for sibling in parent.find_next_siblings("td"):
                value = sibling.get_text(strip=True)
                if value:
                    return value

        # Fallback: inline pattern <b>Label</b> value text
        sib = tag.next_sibling
        if sib:
            value = (sib.get_text(strip=True) if hasattr(sib, "get_text") else str(sib).strip())
            value = value.lstrip(": \t")
            if value:
                return value

    return None


def extract_bold_field_pdf(text: str, label: str) -> str | None:
    """
    Extract a field value from layout-mode PDF text.

    With extraction_mode="layout", pypdf preserves the visual columns so
    label and value appear on the same line separated by whitespace:
      "Danstyp          Schottis"
      "Musik             Han har öppnat Aclaporten..."
    We match the label at the start of a line and capture everything after
    the gap (2+ spaces).
    """
    import re
    pattern = re.compile(
        r"^[ \t]*" + re.escape(label) + r"[ \t]{2,}(.+)",
        re.IGNORECASE | re.MULTILINE,
    )
    m = pattern.search(text)
    return m.group(1).strip() if m else None


def fetch_dance_details(session: requests.Session, entry: dict) -> dict:
    """
    Fetch the individual dance page (.htm or .pdf) and extract Musik and Danstyp.
    Returns the entry dict augmented with 'musik' and 'danstyp' keys.
    """
    url = entry.get("dance_description_url") or ""
    lower_url = url.lower()

    is_html = any(lower_url.endswith(ext) for ext in HTM_EXTENSIONS)
    is_pdf = any(lower_url.endswith(ext) for ext in PDF_EXTENSIONS)

    if not is_html and not is_pdf:
        return {**entry, "musik": None, "danstyp": None}

    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return {**entry, "musik": None, "danstyp": None}
        resp.raise_for_status()

        if is_html:
            resp.encoding = resp.apparent_encoding
            soup = BeautifulSoup(resp.text, "html.parser")
            musik = extract_bold_field_htm(soup, "Musik")
            danstyp = extract_bold_field_htm(soup, "Danstyp")
        else:
            reader = PdfReader(io.BytesIO(resp.content))
            text = "\n".join(
                page.extract_text(extraction_mode="layout") or "" for page in reader.pages
            )
            musik = extract_bold_field_pdf(text, "Musik")
            danstyp = extract_bold_field_pdf(text, "Danstyp")

        return {**entry, "musik": musik, "danstyp": danstyp}
    except Exception:
        return {**entry, "musik": None, "danstyp": None}


def main():
    parser = argparse.ArgumentParser(description="Index ACLA dance directory")
    parser.add_argument(
        "--output", "-o",
        metavar="FILE",
        help="Write output to FILE instead of stdout",
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=DEFAULT_DELAY,
        metavar="SECONDS",
        help=f"Seconds to wait between requests (default: {DEFAULT_DELAY})",
    )
    parser.add_argument(
        "--no-details",
        action="store_true",
        help="Skip fetching individual dance pages (faster, no Musik/Danstyp)",
    )
    parser.add_argument(
        "--limit", "-n",
        type=int,
        default=None,
        metavar="N",
        help="Only process the first N dances from the list",
    )
    args = parser.parse_args()

    session = make_session()

    print("Fetching dance list from ACLA...", file=sys.stderr)
    entries = fetch_list(session)
    print(f"Found {len(entries)} dances.", file=sys.stderr)

    if args.limit is not None:
        entries = entries[: args.limit]
        print(f"Limiting to {len(entries)} dances.", file=sys.stderr)

    if args.no_details:
        results = [{**e, "musik": None, "danstyp": None} for e in entries]
    else:
        htm_count = sum(
            1 for e in entries
            if any((e.get("dance_description_url") or "").lower().endswith(ext)
                   for ext in HTM_EXTENSIONS | PDF_EXTENSIONS)
        )
        print(
            f"Fetching details for {htm_count} pages "
            f"(1 request at a time, {args.delay}s delay)...",
            file=sys.stderr,
        )
        results = []
        for i, entry in enumerate(entries, 1):
            result = fetch_dance_details(session, entry)
            results.append(result)
            if i % 25 == 0 or i == len(entries):
                print(f"  {i}/{len(entries)} done...", file=sys.stderr)
            time.sleep(args.delay)

    output = json.dumps(results, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Wrote {len(results)} dances to {args.output}", file=sys.stderr)
    else:
        print(output)
        print(f"Total: {len(results)} dances", file=sys.stderr)


if __name__ == "__main__":
    main()
