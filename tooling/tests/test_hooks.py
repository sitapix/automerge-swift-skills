import unittest

# Import from the hooks directory directly
import importlib.util
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parents[1] / "hooks"


def _load_module(name: str):
    spec = importlib.util.spec_from_file_location(name, HOOKS_DIR / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


detect_error = _load_module("detect-automerge-error")
detect_prompt = _load_module("detect-automerge-prompt")


class TestDetectAutomergeError(unittest.TestCase):
    def test_doc_error(self):
        result = detect_error.check_output("Fatal error: DocError at line 42")
        self.assertIn("automerge-swift-diag", result)

    def test_load_error(self):
        result = detect_error.check_output("LoadError: invalid bytes")
        self.assertIn("automerge-swift-diag", result)

    def test_coding_key_error(self):
        result = detect_error.check_output("CodingKeyLookupError: key 'title' not found")
        self.assertIn("automerge-swift-diag", result)

    def test_schema_strategy(self):
        result = detect_error.check_output("SchemaStrategy not set on encoder")
        self.assertIn("automerge-swift-codable", result)

    def test_merge_duplicate(self):
        result = detect_error.check_output("merge produced duplicate entries in list")
        self.assertIn("automerge-swift-modeling", result)

    def test_import_automerge(self):
        result = detect_error.check_output("import Automerge")
        self.assertIn("automerge-swift", result)

    def test_no_match(self):
        result = detect_error.check_output("everything is fine, no errors here")
        self.assertIsNone(result)

    def test_empty_input(self):
        result = detect_error.check_output("")
        self.assertIsNone(result)


class TestDetectAutomergePrompt(unittest.TestCase):
    def test_automerge_keyword(self):
        result = detect_prompt.check_prompt("How do I use Automerge in my app?")
        self.assertIn("automerge-swift", result)

    def test_crdt_keyword(self):
        result = detect_prompt.check_prompt("I need a CRDT for my data model")
        self.assertIn("automerge-swift", result)

    def test_objid_keyword(self):
        result = detect_prompt.check_prompt("How do I navigate ObjId?")
        self.assertIn("automerge-swift-core", result)

    def test_encoder_keyword(self):
        result = detect_prompt.check_prompt("AutomergeEncoder is throwing errors")
        self.assertIn("automerge-swift-codable", result)

    def test_sync_state(self):
        result = detect_prompt.check_prompt("How do I persist SyncState?")
        self.assertIn("automerge-swift-sync", result)

    def test_fork_merge(self):
        result = detect_prompt.check_prompt("How do I fork and merge a document?")
        self.assertIn("automerge-swift-sync", result)

    def test_doc_error(self):
        result = detect_prompt.check_prompt("What does DocError mean?")
        self.assertIn("automerge-swift-diag", result)

    def test_no_match(self):
        result = detect_prompt.check_prompt("How do I make a UITableView?")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
