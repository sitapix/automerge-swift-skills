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
    validate_plugin_manifest,
    validate_marketplace_manifest,
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


class TestValidateMarketplaceManifest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_marketplace"
        self.tmp.mkdir(exist_ok=True)
        self.plugin_dir = self.tmp / ".claude-plugin"
        self.plugin_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_marketplace_is_ok(self):
        validate_marketplace_manifest(self.tmp)

    def test_invalid_json_raises(self):
        (self.plugin_dir / "marketplace.json").write_text("{invalid")
        with self.assertRaises(ValidationError):
            validate_marketplace_manifest(self.tmp)

    def test_missing_plugins_array_raises(self):
        (self.plugin_dir / "marketplace.json").write_text(json.dumps({"name": "x"}))
        with self.assertRaises(ValidationError):
            validate_marketplace_manifest(self.tmp)

    def test_agents_field_is_rejected(self):
        marketplace = {
            "plugins": [
                {
                    "name": "automerge-swift",
                    "agents": "./agents/",
                }
            ]
        }
        (self.plugin_dir / "marketplace.json").write_text(json.dumps(marketplace))
        with self.assertRaises(ValidationError):
            validate_marketplace_manifest(self.tmp)

    def test_default_component_paths_are_rejected(self):
        marketplace = {
            "plugins": [
                {
                    "name": "automerge-swift",
                    "commands": "./commands/",
                    "skills": "./skills/",
                    "hooks": "./hooks/hooks.json",
                }
            ]
        }
        (self.plugin_dir / "marketplace.json").write_text(json.dumps(marketplace))
        with self.assertRaises(ValidationError):
            validate_marketplace_manifest(self.tmp)

    def test_marketplace_without_component_paths_is_ok(self):
        marketplace = {
            "plugins": [
                {
                    "name": "automerge-swift",
                    "description": "Automerge plugin",
                }
            ]
        }
        (self.plugin_dir / "marketplace.json").write_text(json.dumps(marketplace))
        validate_marketplace_manifest(self.tmp)


class TestValidatePluginManifest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(__file__).parent / "_tmp_plugin_manifest"
        self.tmp.mkdir(exist_ok=True)
        self.plugin_dir = self.tmp / ".claude-plugin"
        self.plugin_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_plugin_manifest_is_ok(self):
        validate_plugin_manifest(self.tmp)

    def test_invalid_json_raises(self):
        (self.plugin_dir / "plugin.json").write_text("{invalid")
        with self.assertRaises(ValidationError):
            validate_plugin_manifest(self.tmp)

    def test_agents_field_is_rejected(self):
        plugin = {
            "name": "automerge-swift",
            "agents": "./agents/",
        }
        (self.plugin_dir / "plugin.json").write_text(json.dumps(plugin))
        with self.assertRaises(ValidationError):
            validate_plugin_manifest(self.tmp)

    def test_default_component_paths_are_rejected(self):
        plugin = {
            "name": "automerge-swift",
            "commands": "./commands/",
            "skills": "./skills/",
            "hooks": "./hooks/hooks.json",
        }
        (self.plugin_dir / "plugin.json").write_text(json.dumps(plugin))
        with self.assertRaises(ValidationError):
            validate_plugin_manifest(self.tmp)

    def test_plugin_without_component_paths_is_ok(self):
        plugin = {
            "name": "automerge-swift",
            "version": "1.1.1",
        }
        (self.plugin_dir / "plugin.json").write_text(json.dumps(plugin))
        validate_plugin_manifest(self.tmp)


if __name__ == "__main__":
    unittest.main()
