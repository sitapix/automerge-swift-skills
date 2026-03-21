import json
import shutil
import unittest
from pathlib import Path

from scripts.quality.evaluate_skill_descriptions import (
    EvaluationError,
    lint_description,
    load_dataset,
    load_skill_descriptions,
)


class TestLintDescription(unittest.TestCase):
    def test_good_description(self):
        desc = "Use when working with Automerge Swift, CRDTs in Swift, collaborative data, or any code importing Automerge. Routes to specialized sub-skills for core API, Codable mapping, sync protocol, and API reference."
        issues = lint_description("test-skill", desc)
        self.assertEqual(issues, [])

    def test_missing_use_when(self):
        desc = "This skill helps you work with Automerge Swift, CRDTs in Swift, collaborative data."
        issues = lint_description("test-skill", desc)
        self.assertTrue(any("Use when" in i for i in issues))

    def test_too_short(self):
        desc = "Use when short."
        issues = lint_description("test-skill", desc)
        self.assertTrue(any("too short" in i for i in issues))

    def test_workflow_language(self):
        desc = "Use when building CRDTs. This skill will guide you through step 1 and step 2 of the process carefully."
        issues = lint_description("test-skill", desc)
        self.assertTrue(any("workflow-summary" in i for i in issues))


class TestLoadSkillDescriptions(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_descs"
        self.tmp.mkdir(exist_ok=True)
        self.skills_dir = self.tmp / "skills"
        self.skills_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_loads_from_frontmatter(self):
        skill_dir = self.skills_dir / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "---\nname: my-skill\ndescription: Use when doing things with CRDTs and collaborative data in Swift apps.\n---\n\n# My Skill\n"
        )
        descs = load_skill_descriptions(self.tmp)
        self.assertIn("my-skill", descs)
        self.assertTrue(descs["my-skill"].startswith("Use when"))

    def test_skips_missing_frontmatter(self):
        skill_dir = self.skills_dir / "no-fm"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("# No frontmatter here\n")
        descs = load_skill_descriptions(self.tmp)
        self.assertNotIn("no-fm", descs)


class TestLoadDataset(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_dataset"
        self.tmp.mkdir(exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_valid_dataset(self):
        entries = [
            {"skill": "s", "query": "q", "should_trigger": True, "split": "train"}
        ]
        path = self.tmp / "test.json"
        path.write_text(json.dumps(entries))
        data = load_dataset(path)
        self.assertEqual(len(data), 1)

    def test_not_array_raises(self):
        path = self.tmp / "bad.json"
        path.write_text(json.dumps({"not": "an array"}))
        with self.assertRaises(EvaluationError):
            load_dataset(path)

    def test_missing_key_raises(self):
        path = self.tmp / "incomplete.json"
        path.write_text(json.dumps([{"skill": "s"}]))
        with self.assertRaises(EvaluationError):
            load_dataset(path)


if __name__ == "__main__":
    unittest.main()
