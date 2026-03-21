#!/usr/bin/env python3

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
HOOKS_DIR = ROOT / ".githooks"


def main() -> int:
    if not HOOKS_DIR.exists():
        print(f"Missing hooks directory: {HOOKS_DIR}", file=sys.stderr)
        return 1

    try:
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError:
        print("This directory is not inside a Git repository.", file=sys.stderr)
        return 1

    for hook in HOOKS_DIR.iterdir():
        if hook.is_file():
            hook.chmod(0o755)

    subprocess.run(
        ["git", "config", "core.hooksPath", str(HOOKS_DIR)],
        cwd=ROOT,
        check=True,
    )

    print(f"Installed Git hooks from {HOOKS_DIR}")
    print("Use `npm run setup` for first-time setup.")
    print("The pre-commit hook runs npm run check.")
    print("The pre-push hook runs npm run check before pushes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
