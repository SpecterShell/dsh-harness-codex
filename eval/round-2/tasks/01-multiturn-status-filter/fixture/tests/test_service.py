import unittest
from pathlib import Path

from tickets.service import TicketService
from tickets.store import load_tickets

DATA = Path(__file__).resolve().parent.parent / "data" / "tickets.json"


class TicketServiceTest(unittest.TestCase):
    def setUp(self):
        self.service = TicketService(load_tickets(DATA))

    def test_all_tickets_keep_file_order(self):
        self.assertEqual(
            [ticket.id for ticket in self.service.tickets()],
            ["TCK-101", "TCK-102", "TCK-103", "TCK-104",
             "TCK-105", "TCK-106", "TCK-107", "TCK-108"],
        )

    def test_assignee_filter(self):
        self.assertEqual(
            [ticket.id for ticket in self.service.tickets(assignee="mira")],
            ["TCK-101", "TCK-103", "TCK-106"],
        )

    def test_count(self):
        self.assertEqual(self.service.count(), 8)
        self.assertEqual(self.service.count(assignee="sam"), 2)
