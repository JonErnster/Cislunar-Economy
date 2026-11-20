"""Offline checks for source relationships, chronology and the checked-in register."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from build_communications import render, validate


class RegisterChecks(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "data/lunar-communications.json").read_text(encoding="utf-8"))
        self.record = self.data["records"][0]
        self.source = self.data["sources"][0]

    def test_page_matches_register(self):
        self.assertEqual(render(self.data), (ROOT / "infrastructure/index.html").read_text(encoding="utf-8"))

    def test_claim_needs_a_known_source(self):
        self.record["claims"][0]["source"] = "missing"
        with self.assertRaises(ValueError):
            validate(self.data)

    def test_identifiers_are_unique(self):
        self.data["records"].append(copy.deepcopy(self.record))
        with self.assertRaises(ValueError):
            validate(self.data)

    def test_review_cannot_precede_its_sources(self):
        self.source["published_on"] = "2099-01-01"
        with self.assertRaises(ValueError):
            validate(self.data)

    def test_status_requires_evidence_by_its_source_date(self):
        self.record["status_as_of"] = "2099-01-01"
        with self.assertRaises(ValueError):
            validate(self.data)

    def test_unknown_status_requires_editorial_review(self):
        self.record["status"] = "assumed_available"
        with self.assertRaises(ValueError):
            validate(self.data)


if __name__ == "__main__":
    unittest.main()
