#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
SERVER_INFO_VERSION_RE = re.compile(r'(^\s*version:\s*")(\d+\.\d+\.\d+)(",?$)', re.MULTILINE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update plugin manifest versions in one place."
    )
    parser.add_argument("version", help="Version number in X.Y.Z format")
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="Plugin root to update (default: repository root).",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def update_server_info_version(path: Path, version: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = SERVER_INFO_VERSION_RE.subn(rf"\g<1>{version}\g<3>", text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not update server version in {path}")
    path.write_text(updated, encoding="utf-8")


def main() -> int:
    args = parse_args()
    if not VERSION_RE.match(args.version):
        raise SystemExit("ERROR: version must use X.Y.Z format")

    root = Path(args.root).resolve()
    targets = [
        root / "claude-code.json",
        root / ".claude-plugin" / "plugin.json",
        root / ".claude-plugin" / "marketplace.json",
        root / "package.json",
        root / "mcp-server" / "package.json",
    ]

    updated: list[Path] = []
    for path in targets:
        if not path.exists():
            continue
        data = load_json(path)
        data["version"] = args.version

        if path.name == "marketplace.json":
            data.setdefault("metadata", {})["version"] = args.version
            plugins = data.get("plugins", [])
            if len(plugins) == 1:
                plugins[0]["version"] = args.version

        write_json(path, data)
        updated.append(path)

    server_path = root / "src" / "server.mjs"
    if server_path.exists():
        update_server_info_version(server_path, args.version)
        updated.append(server_path)

    for path in updated:
        print(f"Updated {path.relative_to(root).as_posix()} -> {args.version}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
