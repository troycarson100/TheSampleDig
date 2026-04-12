#!/usr/bin/env python3
"""
YouTube search results via Crawl4AI (https://github.com/unclecode/crawl4ai).
Prints a JSON array of objects compatible with lib/youtube-scraper ScrapedVideoItem.

Usage: yt_search_crawl4ai.py "<query>"
Stderr: logs only; stdout: JSON only.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from urllib.parse import quote_plus


def _extract_yt_initial_data(html: str) -> dict | None:
    m = re.search(r'<script[^>]+id="ytInitialData"[^>]*>(.+?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _collect_video_renderers(obj, out: list) -> None:
    if isinstance(obj, dict):
        if "videoRenderer" in obj:
            out.append(obj["videoRenderer"])
            return
        for v in obj.values():
            _collect_video_renderers(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_video_renderers(item, out)


def _parse_duration_seconds(text: str | None) -> int | None:
    if not text or not isinstance(text, str):
        return None
    parts = [int(x) for x in text.strip().split(":") if x.isdigit()]
    try:
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except (ValueError, IndexError):
        pass
    return None


def _renderer_to_item(r: dict) -> dict | None:
    vid = None
    url = (
        r.get("navigationEndpoint", {})
        .get("commandMetadata", {})
        .get("webCommandMetadata", {})
        .get("url", "")
    )
    if isinstance(url, str) and url.startswith("/watch?v="):
        vid = url.replace("/watch?v=", "").split("&")[0]
    if not vid:
        vid = r.get("videoId")
    if not vid or not isinstance(vid, str):
        return None

    title = ""
    t = r.get("title") or {}
    runs = t.get("runs")
    if runs and isinstance(runs, list) and runs:
        title = runs[0].get("text") or ""
    elif isinstance(t.get("simpleText"), str):
        title = t["simpleText"]

    ch = ""
    cid = None
    for key in ("ownerText", "longBylineText"):
        runs2 = (r.get(key) or {}).get("runs") or []
        if runs2:
            ch = runs2[0].get("text") or ""
            ne = runs2[0].get("navigationEndpoint", {}).get("browseEndpoint", {})
            cid = ne.get("browseId")
            break

    dur_sec = None
    for o in r.get("thumbnailOverlays") or []:
        tt = (
            (o.get("thumbnailOverlayTimeStatusRenderer") or {})
            .get("text", {})
            .get("simpleText")
        )
        dur_sec = _parse_duration_seconds(tt)
        if dur_sec is not None:
            break

    thumb = f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"
    item: dict = {
        "id": {"videoId": vid},
        "snippet": {
            "title": title or "Unknown",
            "channelTitle": ch or "Unknown",
            "thumbnails": {"default": {"url": thumb}, "medium": {"url": thumb}},
        },
    }
    if cid:
        item["snippet"]["channelId"] = cid
    if dur_sec is not None:
        item["duration"] = dur_sec
    return item


def _items_from_html(html: str) -> list[dict]:
    data = _extract_yt_initial_data(html)
    items: list[dict] = []
    if data:
        renderers: list = []
        _collect_video_renderers(data, renderers)
        seen: set[str] = set()
        for r in renderers:
            item = _renderer_to_item(r)
            if not item:
                continue
            vid = item["id"]["videoId"]
            if vid in seen:
                continue
            seen.add(vid)
            items.append(item)
    if items:
        return items
    # DOM fallback: watch links only
    seen2: set[str] = set()
    for m in re.finditer(r'href="/watch\?v=([a-zA-Z0-9_-]{11})"', html):
        vid = m.group(1)
        if vid in seen2:
            continue
        seen2.add(vid)
        thumb = f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"
        items.append(
            {
                "id": {"videoId": vid},
                "snippet": {
                    "title": "Unknown",
                    "channelTitle": "Unknown",
                    "thumbnails": {"default": {"url": thumb}, "medium": {"url": thumb}},
                },
            }
        )
    return items


def _result_html(result) -> str:
    for attr in ("html", "cleaned_html", "raw_html"):
        if hasattr(result, attr):
            h = getattr(result, attr)
            if isinstance(h, str) and h.strip():
                return h
    return ""


async def _crawl(query: str) -> list[dict]:
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    except ImportError:
        print(
            json.dumps(
                {
                    "error": "crawl4ai not installed. pip install -r scripts/requirements-crawl4ai.txt && crawl4ai-setup"
                }
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)

    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
    browser_config = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

    html = _result_html(result)
    if not html:
        return []
    return _items_from_html(html)


async def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing query argv"}), file=sys.stderr)
        raise SystemExit(2)
    query = sys.argv[1]
    items = await _crawl(query)
    print(json.dumps(items))


if __name__ == "__main__":
    asyncio.run(main())
