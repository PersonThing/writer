#!/usr/bin/env bash
# One-shot crawl of shigorika.com.
#   - Fetches each known page as raw HTML into scripts/crawl/raw/
#   - Extracts every wixstatic.com media URL, strips Wix's CDN transform
#     suffix to recover the full-res original, deduplicates
#   - Downloads every unique original into src/renderer/public/portfolio/images/
#     using the Wix media ID as the filename (idempotent across re-runs)
#   - Writes scripts/crawl/manifest.json — {page_slug: [image_file, ...]}
#
# Requires: curl, jq, sed, grep, awk
set -e

cd "$(dirname "$0")/.."
ROOT=$PWD
RAW_DIR=$ROOT/scripts/crawl/raw
IMG_DIR=$ROOT/src/renderer/public/portfolio/images
MANIFEST=$ROOT/scripts/crawl/manifest.json
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

mkdir -p "$RAW_DIR" "$IMG_DIR"

pages=(
  "/|home"
  "/about|about"
  "/contact|contact"
  "/recommendations|recommendations"
  "/copy-1|work-copywriting"
  "/creative-direction|work-creative-direction"
  "/fashion-editorial|work-fashion-editorial"
  "/editorial|work-editorial"
  "/poetry|work-poetry"
  "/published-paper|work-published-paper"
)

echo "{" > "$MANIFEST.tmp"
first=1

for entry in "${pages[@]}"; do
  path="${entry%%|*}"
  slug="${entry##*|}"
  url="https://www.shigorika.com$path"
  html_file="$RAW_DIR/$slug.html"

  echo ""
  echo "── Fetching $url → $slug.html"
  curl -sL -A "$UA" "$url" -o "$html_file"

  size=$(wc -c < "$html_file" | tr -d ' ')
  echo "   $size bytes"

  # Extract wix media URLs, strip transforms, dedupe
  urls=$(grep -oE 'https://static\.wixstatic\.com/media/[^"'\'' ]+' "$html_file" \
    | sed -E 's|(~mv2\.[a-zA-Z0-9]+)/v1/.*$|\1|' \
    | sed -E 's|(~mv2\.[a-zA-Z0-9]+)\\.+$|\1|' \
    | sort -u)

  count=$(echo "$urls" | grep -c '^https' || true)
  echo "   $count unique originals"

  page_files=()
  while IFS= read -r u; do
    [ -z "$u" ] && continue
    # filename = full path after /media/, replacing / with _
    fname=$(echo "$u" | sed -E 's|^https://static\.wixstatic\.com/media/||' | tr '/' '_')
    dest="$IMG_DIR/$fname"

    if [ ! -f "$dest" ]; then
      echo "   ↓ $fname"
      curl -sL -A "$UA" "$u" -o "$dest" || echo "     (failed: $u)"
    fi
    page_files+=("$fname")
  done <<< "$urls"

  # Append to manifest
  if [ $first -eq 1 ]; then
    first=0
  else
    echo "," >> "$MANIFEST.tmp"
  fi
  printf '  "%s": [' "$slug" >> "$MANIFEST.tmp"
  for i in "${!page_files[@]}"; do
    [ $i -gt 0 ] && printf ", " >> "$MANIFEST.tmp"
    printf '"%s"' "${page_files[$i]}" >> "$MANIFEST.tmp"
  done
  printf "]" >> "$MANIFEST.tmp"
done

echo "" >> "$MANIFEST.tmp"
echo "}" >> "$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"

echo ""
echo "── Done. Manifest written to $MANIFEST"
echo "── Images in $IMG_DIR"
ls "$IMG_DIR" | wc -l | awk '{print "   " $1 " files"}'
du -sh "$IMG_DIR" | awk '{print "   " $1 " total"}'
