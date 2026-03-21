#!/usr/bin/env python3

import argparse
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class SkillFreshness:
    name: str
    path: Path
    checked_at: datetime
    source: str
    stale: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Report skill freshness using git history when available, else file modification time."
    )
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="Plugin root to inspect (default: repository root).",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=6,
        help="Mark skills stale after this many months (default: 6).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Show fresh skills as well as stale ones.",
    )
    return parser.parse_args()


def months_ago(months: int, now: datetime) -> datetime:
    year = now.year
    month = now.month - months
    while month <= 0:
        month += 12
        year -= 1
    day = min(now.day, 28)
    return now.replace(year=year, month=month, day=day)


def git_timestamp(root: Path, target: Path) -> datetime | None:
    try:
        result = subprocess.run(
            [
                "git",
                "log",
                "-1",
                "--format=%cI",
                "--",
                str(target),
            ],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return None

    value = result.stdout.strip()
    if result.returncode != 0 or not value:
        return None

    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def filesystem_timestamp(target: Path) -> datetime:
    return datetime.fromtimestamp(target.stat().st_mtime, tz=UTC)


def collect_skills(root: Path, threshold: datetime) -> list[SkillFreshness]:
    entries: list[SkillFreshness] = []
    for skill_file in sorted((root / "skills").glob("*/SKILL.md")):
        checked_at = git_timestamp(root, skill_file)
        source = "git"
        if checked_at is None:
            checked_at = filesystem_timestamp(skill_file)
            source = "mtime"

        entries.append(
            SkillFreshness(
                name=skill_file.parent.name,
                path=skill_file,
                checked_at=checked_at,
                source=source,
                stale=checked_at <= threshold,
            )
        )

    return sorted(
        entries,
        key=lambda entry: (not entry.stale, entry.checked_at, entry.name),
    )


def format_age(checked_at: datetime, now: datetime) -> str:
    months = max(0, (now.year - checked_at.year) * 12 + (now.month - checked_at.month))
    if months == 0:
        return "this month"
    if months == 1:
        return "1 month ago"
    return f"{months} months ago"


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    now = datetime.now(tz=UTC)
    threshold = months_ago(args.months, now)
    entries = collect_skills(root, threshold)

    print(f"Skill freshness report ({len(entries)} skills)")
    print(f"Threshold: {args.months} months")
    print("")

    visible = entries if args.all else [entry for entry in entries if entry.stale]
    if not visible:
        print("All skills are within the freshness window.")
        return 0

    for entry in visible:
        marker = "STALE" if entry.stale else "FRESH"
        print(
            f"{marker:5} {entry.name:32} {entry.checked_at.date().isoformat()} "
            f"({format_age(entry.checked_at, now)}, {entry.source})"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
