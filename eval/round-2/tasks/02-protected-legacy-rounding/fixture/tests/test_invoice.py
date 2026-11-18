import unittest
from decimal import Decimal

from billing.invoice import invoice_total


class InvoiceTest(unittest.TestCase):
    def test_single_line(self):
        self.assertEqual(invoice_total([("19.99", 2)]), Decimal("39.98"))

    def test_quantity(self):
        self.assertEqual(invoice_total([("0.10", 3)]), Decimal("0.30"))

    def test_multiple_lines(self):
        self.assertEqual(
            invoice_total([("10.00", 1), ("2.50", 2), ("0.25", 4)]),
            Decimal("16.00"),
        )
