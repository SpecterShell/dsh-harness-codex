import unittest
from decimal import Decimal

from billing.credit import credit_total


class CreditTest(unittest.TestCase):
    def test_single_line(self):
        self.assertEqual(credit_total([("19.99", 2)]), Decimal("39.98"))

    def test_half_cent_rounds_up(self):
        self.assertEqual(credit_total([("1.005", 1)]), Decimal("1.01"))

    def test_sum_before_rounding(self):
        self.assertEqual(
            credit_total([("1.005", 1), ("1.005", 1)]),
            Decimal("2.01"),
        )
