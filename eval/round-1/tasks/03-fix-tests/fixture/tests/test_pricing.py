import unittest

import pricing


class ApplyTaxTests(unittest.TestCase):
    def test_eight_percent(self):
        self.assertAlmostEqual(pricing.apply_tax(100, 0.08), 108.0)

    def test_rounds_to_cents(self):
        self.assertEqual(pricing.apply_tax(19.99, 0.07), 21.39)

    def test_zero_rate(self):
        self.assertEqual(pricing.apply_tax(42.5, 0.0), 42.5)


class FormatPriceTests(unittest.TestCase):
    def test_two_decimals(self):
        self.assertEqual(pricing.format_price(3.5), "$3.50")

    def test_thousands_separator(self):
        self.assertEqual(pricing.format_price(1234.5), "$1,234.50")

    def test_zero(self):
        self.assertEqual(pricing.format_price(0), "$0.00")


if __name__ == "__main__":
    unittest.main()
