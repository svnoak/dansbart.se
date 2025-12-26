#!/usr/bin/env python3
"""
Example script for downloading the Dansbart dataset.

This script demonstrates how to:
1. Check dataset statistics
2. Download the full dataset in batches
3. Download feedback data separately

Usage:
    python download_dataset.py [--batch-size 1000] [--output-dir ./data]
"""

import requests
import json
import argparse
from pathlib import Path
from typing import Dict, Any


BASE_URL = "https://dansbart.se/api"  # Change to your API URL if testing locally


def get_dataset_stats() -> Dict[str, Any]:
    """Get statistics about the available dataset."""
    response = requests.get(f"{BASE_URL}/export/stats")
    response.raise_for_status()
    return response.json()


def download_dataset_batch(limit: int, offset: int) -> Dict[str, Any]:
    """Download a batch of the dataset."""
    params = {"limit": limit, "offset": offset}
    response = requests.get(f"{BASE_URL}/export/dataset", params=params)
    response.raise_for_status()
    return response.json()


def download_full_dataset(output_dir: Path, batch_size: int = 1000):
    """Download the full dataset in batches."""
    print("Fetching dataset statistics...")
    stats = get_dataset_stats()
    total_tracks = stats["total_tracks"]
    print(f"Total tracks available: {total_tracks}")
    print(f"User confirmations: {stats['tracks_with_user_confirmations']}")
    print(f"Dance styles: {stats['dance_styles_count']}")
    print()

    output_dir.mkdir(parents=True, exist_ok=True)

    # Download in batches
    all_tracks = []
    offset = 0
    batch_num = 1

    while offset < total_tracks:
        print(f"Downloading batch {batch_num} (offset: {offset})...")
        batch_data = download_dataset_batch(batch_size, offset)
        tracks = batch_data["tracks"]
        all_tracks.extend(tracks)

        # Save batch to file
        batch_file = output_dir / f"batch_{batch_num}.json"
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch_data, f, indent=2, ensure_ascii=False)

        print(f"  Saved {len(tracks)} tracks to {batch_file}")

        offset += batch_size
        batch_num += 1

    # Save complete dataset
    complete_file = output_dir / "complete_dataset.json"
    complete_data = download_dataset_batch(None, 0)  # Get all at once with metadata

    with open(complete_file, 'w', encoding='utf-8') as f:
        json.dump(complete_data, f, indent=2, ensure_ascii=False)

    print(f"\nComplete dataset saved to {complete_file}")
    print(f"Total tracks downloaded: {len(all_tracks)}")


def download_feedback_data(output_dir: Path):
    """Download human feedback and ground truth data."""
    print("Downloading feedback data...")
    response = requests.get(f"{BASE_URL}/export/feedback")
    response.raise_for_status()
    feedback_data = response.json()

    output_dir.mkdir(parents=True, exist_ok=True)
    feedback_file = output_dir / "feedback_data.json"

    with open(feedback_file, 'w', encoding='utf-8') as f:
        json.dump(feedback_data, f, indent=2, ensure_ascii=False)

    print(f"Feedback data saved to {feedback_file}")
    print(f"  Style votes: {len(feedback_data['style_votes'])}")
    print(f"  Feel votes: {len(feedback_data['feel_votes'])}")
    print(f"  Dance movement consensus: {len(feedback_data['dance_movement_consensus'])}")
    print(f"  Structure annotations: {len(feedback_data['structure_annotations'])}")


def main():
    parser = argparse.ArgumentParser(
        description="Download the Dansbart open dataset"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Number of tracks per batch (default: 1000)"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./dansbart_data"),
        help="Output directory for downloaded data (default: ./dansbart_data)"
    )
    parser.add_argument(
        "--feedback-only",
        action="store_true",
        help="Download only feedback data, not the full dataset"
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default=BASE_URL,
        help=f"API base URL (default: {BASE_URL})"
    )

    args = parser.parse_args()

    # Update base URL if provided
    global BASE_URL
    BASE_URL = args.base_url.rstrip('/')

    print("=" * 60)
    print("Dansbart Dataset Downloader")
    print("=" * 60)
    print()

    try:
        if args.feedback_only:
            download_feedback_data(args.output_dir)
        else:
            download_full_dataset(args.output_dir, args.batch_size)
            download_feedback_data(args.output_dir)

        print()
        print("=" * 60)
        print("Download complete!")
        print("=" * 60)
        print()
        print("License: CC BY 4.0")
        print("Attribution: Dansbart.se - Swedish Folk Dance Music Analysis Dataset")
        print("URL: https://dansbart.se")
        print()
        print("If you use this data, please cite Dansbart.se and consider")
        print("contributing improvements back to the community.")

    except requests.exceptions.RequestException as e:
        print(f"Error downloading data: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
