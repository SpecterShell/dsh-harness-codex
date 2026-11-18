import unittest
from pathlib import Path

from expenses import filter_by_category, load_expenses

DATA = Path(__file__).resolve().parents[1] / "data" / "expenses.csv"


class FilterTests(unittest.TestCase):
    def setUp(self):
        self.rows = load_expenses(DATA)

    def test_returns_matching_category(self):
        got = filter_by_category(self.rows, "travel")
        self.assertEqual([row["id"] for row in got], [1, 4])

    def test_matches_ignoring_case(self):
        got = filter_by_category(self.rows, "MEALS")
        self.assertEqual([row["id"] for row in got], [2, 5])

    def test_keeps_id_order(self):
        got = filter_by_category(self.rows, "office")
        self.assertEqual([row["id"] for row in got], [3, 6])

    def test_unknown_category_is_empty(self):
        self.assertEqual(filter_by_category(self.rows, "hardware"), [])


if __name__ == "__main__":
    unittest.main()
