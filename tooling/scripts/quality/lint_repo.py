#!/usr/bin/env python3

import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
TEXT_SUFFIXES = {
    ".css",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
TEXT_FILENAMES = {
    ".gitignore",
    ".npmignore",
    "AGENTS.md",
    "LICENSE",
    "README.md",
}
SHELL_FILE_NAMES = {
    "pre-commit",
    "pre-push",
}
SKIP_DIRS = {
    ".git",
    ".npm-cache",
    ".uv-cache",
    ".venv",
    "__pycache__",
    "node_modules",
}
SKIP_PATH_PREFIXES = {
    "vendor",
}
INDENT_WITH_SPACES_SUFFIXES = {
    ".css",
    ".js",
    ".json",
    ".mjs",
    ".py",
    ".sh",
    ".toml",
    ".yaml",
    ".yml",
}
TRAILING_WHITESPACE_EXEMPT_SUFFIXES = {
    ".md",
}


def relative_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def should_skip(path: Path, root: Path) -> bool:
    rel = relative_path(path, root)
    if any(part in SKIP_DIRS for part in path.parts):
        return True
    return any(rel == prefix or rel.startswith(prefix + "/") for prefix in SKIP_PATH_PREFIXES)


def is_shell_target(path: Path, root: Path) -> bool:
    rel = relative_path(path, root)
    return path.suffix == ".sh" or rel.startswith(".githooks/") or path.name in SHELL_FILE_NAMES


def is_text_target(path: Path, root: Path) -> bool:
    return path.suffix in TEXT_SUFFIXES or path.name in TEXT_FILENAMES or is_shell_target(path, root)


def iter_targets(root: Path) -> list[Path]:
    targets: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path, root):
            continue
        if is_text_target(path, root):
            targets.append(path)
    return sorted(targets)


def check_common_text_rules(path: Path, text: str) -> list[str]:
    issues: list[str] = []
    if "\r\n" in text:
        issues.append("uses CRLF line endings")
    if text and not text.endswith("\n"):
        issues.append("missing trailing newline")

    for line_number, line in enumerate(text.splitlines(), start=1):
        if path.suffix not in TRAILING_WHITESPACE_EXEMPT_SUFFIXES and line.rstrip(" \t") != line:
            issues.append(f"line {line_number}: trailing whitespace")
        if path.suffix in INDENT_WITH_SPACES_SUFFIXES:
            indentation = line[: len(line) - len(line.lstrip(" \t"))]
            if "\t" in indentation:
                issues.append(f"line {line_number}: tab indentation")
    return issues


def check_json(path: Path, text: str) -> list[str]:
    try:
        json.loads(text)
    except json.JSONDecodeError as exc:
        return [f"invalid JSON: line {exc.lineno} column {exc.colno}: {exc.msg}"]
    return []


def check_python(path: Path, text: str) -> list[str]:
    try:
        ast.parse(text, filename=str(path))
    except SyntaxError as exc:
        line = exc.lineno or 1
        column = exc.offset or 1
        return [f"invalid Python syntax: line {line} column {column}: {exc.msg}"]
    return []


def shell_syntax_command(text: str) -> list[str]:
    first_line = text.splitlines()[0] if text.splitlines() else ""
    if "bash" in first_line:
        return ["bash", "-n"]
    return ["sh", "-n"]


def check_shell(path: Path, text: str) -> list[str]:
    result = subprocess.run(
        [*shell_syntax_command(text), str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        return []

    stderr = result.stderr.strip() or result.stdout.strip() or "shell syntax check failed"
    return [stderr]


def lint_path(path: Path, root: Path) -> list[str]:
    rel = relative_path(path, root)
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return [f"{rel}: not valid UTF-8"]

    issues = [f"{rel}: {issue}" for issue in check_common_text_rules(path, text)]

    if path.suffix == ".json":
        issues.extend(f"{rel}: {issue}" for issue in check_json(path, text))
    if path.suffix == ".py":
        issues.extend(f"{rel}: {issue}" for issue in check_python(path, text))
    if is_shell_target(path, root):
        issues.extend(f"{rel}: {issue}" for issue in check_shell(path, text))

    return issues


def lint_repo(root: Path) -> list[str]:
    issues: list[str] = []
    for path in iter_targets(root):
        issues.extend(lint_path(path, root))
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Run lightweight repo lint checks.")
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="Repository root to lint (default: current repo).",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()

    issues = lint_repo(root)
    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        print(f"Found {len(issues)} lint issue(s).", file=sys.stderr)
        return 1

    print("Repo lint passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
