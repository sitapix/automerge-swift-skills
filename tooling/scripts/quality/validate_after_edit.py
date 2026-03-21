#!/usr/bin/env python3

import json
import subprocess
import sys
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[3]
VALIDATE_SCRIPT = PLUGIN_ROOT / "tooling" / "scripts" / "quality" / "validate_plugin.py"
DESCRIPTION_SCRIPT = PLUGIN_ROOT / "tooling" / "scripts" / "quality" / "evaluate_skill_descriptions.py"

WATCHED_PATHS = {
    "README.md",
    "AGENTS.md",
    "claude-code.json",
}
WATCHED_PREFIXES = (
    "commands/",
    "skills/",
    "agents/",
    ".githooks/",
    ".claude-plugin/",
    "tooling/hooks/",
)


def extract_candidate_paths(payload: object) -> set[str]:
    candidates: set[str] = set()

    if isinstance(payload, dict):
        for key in ("file_path", "path"):
            value = payload.get(key)
            if isinstance(value, str):
                candidates.add(value)

        tool_input = payload.get("tool_input")
        if isinstance(tool_input, dict):
            for key in ("file_path", "path"):
                value = tool_input.get(key)
                if isinstance(value, str):
                    candidates.add(value)

    normalized: set[str] = set()
    for raw in candidates:
        path = Path(raw)
        try:
            if path.is_absolute():
                rel = path.resolve().relative_to(PLUGIN_ROOT.resolve())
                normalized.add(rel.as_posix())
            else:
                normalized.add(path.as_posix())
        except Exception:
            normalized.add(path.as_posix())

    return normalized


def should_validate(paths: set[str]) -> bool:
    if not paths:
        return True

    for path in paths:
        if path in WATCHED_PATHS:
            return True
        if any(path.startswith(prefix) for prefix in WATCHED_PREFIXES):
            return True

    return False


def main() -> int:
    raw = sys.stdin.read().strip()
    payload = {}
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}

    changed_paths = extract_candidate_paths(payload)
    if not should_validate(changed_paths):
        return 0

    commands = [
        [sys.executable, str(VALIDATE_SCRIPT)],
        [sys.executable, str(DESCRIPTION_SCRIPT), "--dataset", str(PLUGIN_ROOT / "tooling" / "evals" / "description-triggers.json")],
    ]

    messages: list[str] = []
    for command in commands:
        result = subprocess.run(
            command,
            cwd=PLUGIN_ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            if result.stdout:
                sys.stdout.write(result.stdout)
            if result.stderr:
                sys.stderr.write(result.stderr)
            return result.returncode
        if result.stdout.strip():
            messages.append(result.stdout.strip())

    message = "\n".join(messages) or "Plugin validation passed."
    sys.stdout.write(message + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
