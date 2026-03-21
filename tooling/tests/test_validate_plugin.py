import json
import shutil
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.quality.validate_plugin import (
    ValidationError,
    discover_skill_dirs,
    fail,
    validate_catalog,
)


class TestFail(unittest.TestCase):
    def test_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            fail("boom")


class TestDiscoverSkillDirs(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_discover"
        self.tmp.mkdir(exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_missing_skills_dir(self):
        with self.assertRaises(ValidationError):
            discover_skill_dirs(self.tmp)

    def test_empty_skills_dir(self):
        (self.tmp / "skills").mkdir()
        with self.assertRaises(ValidationError):
            discover_skill_dirs(self.tmp)

    def test_finds_skill_dirs(self):
        skills = self.tmp / "skills"
        skills.mkdir()
        (skills / "skill-a").mkdir()
        (skills / "skill-b").mkdir()
        (skills / "catalog.json").write_text("{}")

        dirs = discover_skill_dirs(self.tmp)
        names = [d.name for d in dirs]
        self.assertIn("skill-a", names)
        self.assertIn("skill-b", names)
        self.assertNotIn("catalog.json", names)


class TestValidateCatalog(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_catalog"
        self.tmp.mkdir(exist_ok=True)
        self.skills_dir = self.tmp / "skills"
        self.skills_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_catalog_is_ok(self):
        skill_dirs = []
        validate_catalog(self.tmp, skill_dirs)

    def test_invalid_json_raises(self):
        (self.skills_dir / "catalog.json").write_text("{invalid")
        with self.assertRaises(ValidationError):
            validate_catalog(self.tmp, [])

    def test_missing_skills_key_raises(self):
        (self.skills_dir / "catalog.json").write_text(json.dumps({"other": []}))
        with self.assertRaises(ValidationError):
            validate_catalog(self.tmp, [])

    def test_sync_ok(self):
        (self.skills_dir / "my-skill").mkdir()
        catalog = {"skills": [{"name": "my-skill", "category": "test"}]}
        (self.skills_dir / "catalog.json").write_text(json.dumps(catalog))
        validate_catalog(self.tmp, [self.skills_dir / "my-skill"])

    def test_missing_from_catalog(self):
        (self.skills_dir / "my-skill").mkdir()
        catalog = {"skills": []}
        (self.skills_dir / "catalog.json").write_text(json.dumps(catalog))
        with self.assertRaises(ValidationError):
            validate_catalog(self.tmp, [self.skills_dir / "my-skill"])

    def test_extra_in_catalog(self):
        catalog = {"skills": [{"name": "ghost-skill"}]}
        (self.skills_dir / "catalog.json").write_text(json.dumps(catalog))
        with self.assertRaises(ValidationError):
            validate_catalog(self.tmp, [])


if __name__ == "__main__":
    unittest.main()
