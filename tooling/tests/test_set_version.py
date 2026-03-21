import json
import shutil
import unittest
from pathlib import Path

from scripts.release.set_version import load_json, update_server_info_version, write_json


class TestJsonHelpers(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_version"
        self.tmp.mkdir(exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_roundtrip(self):
        path = self.tmp / "test.json"
        data = {"version": "1.0.0", "name": "test"}
        write_json(path, data)
        loaded = load_json(path)
        self.assertEqual(loaded, data)

    def test_trailing_newline(self):
        path = self.tmp / "test.json"
        write_json(path, {"a": 1})
        text = path.read_text(encoding="utf-8")
        self.assertTrue(text.endswith("\n"))

    def test_indent(self):
        path = self.tmp / "test.json"
        write_json(path, {"a": 1})
        text = path.read_text(encoding="utf-8")
        self.assertIn("  ", text)


class TestServerVersionSync(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_server_version"
        self.tmp.mkdir(exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_updates_server_info_version(self):
        path = self.tmp / "server.mjs"
        path.write_text(
            'const SERVER_INFO = {\n  name: "automerge-swift-docs",\n  version: "0.1.0",\n};\n',
            encoding="utf-8",
        )

        update_server_info_version(path, "1.2.3")

        self.assertIn('version: "1.2.3"', path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
