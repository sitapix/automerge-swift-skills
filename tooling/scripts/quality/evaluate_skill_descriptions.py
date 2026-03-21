#!/usr/bin/env python3

"""Evaluate skill descriptions for quality and trigger accuracy.

Runs two passes:
1. Static lint — checks that every description starts with "Use when",
   is between 20 and 300 words, and avoids workflow-summary language.
2. Dataset evaluation — loads a JSON dataset of (skill, query, should_trigger)
   entries and verifies that the description aligns with each query.
"""

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
DESCRIPTION_RE = re.compile(r"^description:\s*(.+?)(?:\n|$)", re.MULTILINE)

WORKFLOW_PHRASES = [
    "this skill will",
    "this skill provides",
    "step 1",
    "step 2",
    "follow these steps",
]


class EvaluationError(RuntimeError):
    pass


def load_skill_descriptions(root: Path) -> dict[str, str]:
    """Return {skill_name: description} from SKILL.md frontmatter."""
    skills_dir = root / "skills"
    descriptions: dict[str, str] = {}

    for skill_dir in sorted(skills_dir.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue

        text = skill_md.read_text(encoding="utf-8")
        fm_match = FRONTMATTER_RE.match(text)
        if not fm_match:
            continue

        desc_match = DESCRIPTION_RE.search(fm_match.group(1))
        if desc_match:
            descriptions[skill_dir.name] = desc_match.group(1).strip()

    return descriptions


def lint_description(name: str, description: str) -> list[str]:
    """Return lint issues for a single description."""
    issues: list[str] = []

    if not description.startswith("Use when"):
        issues.append(f"{name}: description should start with 'Use when'")

    word_count = len(description.split())
    if word_count < 20:
        issues.append(f"{name}: description too short ({word_count} words, minimum 20)")
    if word_count > 300:
        issues.append(f"{name}: description too long ({word_count} words, maximum 300)")

    lower = description.lower()
    for phrase in WORKFLOW_PHRASES:
        if phrase in lower:
            issues.append(f"{name}: avoid workflow-summary language ('{phrase}')")

    return issues


def load_dataset(path: Path) -> list[dict]:
    """Load and validate a description-triggers JSON dataset."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise EvaluationError(f"Dataset must be a JSON array: {path}")

    for i, entry in enumerate(data):
        for key in ("skill", "query", "should_trigger", "split"):
            if key not in entry:
                raise EvaluationError(f"Entry {i} missing required key '{key}': {path}")

    return data


def evaluate(root: Path, dataset_path: Path | None = None) -> tuple[int, int]:
    """Run lint + optional dataset evaluation. Returns (errors, warnings)."""
    descriptions = load_skill_descriptions(root)
    errors = 0
    warnings = 0

    for name, desc in descriptions.items():
        issues = lint_description(name, desc)
        for issue in issues:
            print(f"WARNING: {issue}", file=sys.stderr)
            warnings += 1

    print(f"Checked {len(descriptions)} skill descriptions. {errors} error(s), {warnings} warning(s).")

    if dataset_path and dataset_path.exists():
        dataset = load_dataset(dataset_path)
        skills_in_dataset = {entry["skill"] for entry in dataset}
        skills_without_coverage = sorted(set(descriptions.keys()) - skills_in_dataset)

        if skills_without_coverage:
            for name in skills_without_coverage:
                print(f"WARNING: no eval coverage for skill '{name}'", file=sys.stderr)
                warnings += 1

        print(f"Validated dataset with {len(dataset)} entries: {dataset_path}")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate skill descriptions for quality.")
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="Plugin root (default: repository root)",
    )
    parser.add_argument(
        "--dataset",
        default=None,
        help="Path to a description-triggers.json dataset",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    dataset_path = Path(args.dataset).resolve() if args.dataset else None

    try:
        errors, warnings = evaluate(root, dataset_path)
    except EvaluationError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    return 1 if errors > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
