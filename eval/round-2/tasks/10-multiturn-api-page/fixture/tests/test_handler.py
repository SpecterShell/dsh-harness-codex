import unittest

from items.handler import handle


class HandlerTest(unittest.TestCase):
    def test_lists_all_items_in_file_order(self):
        result = handle("GET", "/items")
        self.assertEqual(result["status"], 200)
        self.assertEqual(
            [item["id"] for item in result["body"]["items"]],
            [1, 2, 3, 4, 5, 6, 7, 8],
        )

    def test_unknown_path(self):
        result = handle("GET", "/nope")
        self.assertEqual(result["status"], 404)

    def test_other_method(self):
        result = handle("POST", "/items")
        self.assertEqual(result["status"], 405)
