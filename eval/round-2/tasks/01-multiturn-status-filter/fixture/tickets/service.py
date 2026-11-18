class TicketService:
    def __init__(self, tickets):
        self._tickets = list(tickets)

    def tickets(self, assignee=None):
        rows = self._tickets
        if assignee is not None:
            rows = [ticket for ticket in rows if ticket.assignee == assignee]
        return rows

    def count(self, assignee=None):
        return len(self.tickets(assignee=assignee))

    def get(self, ticket_id):
        for ticket in self._tickets:
            if ticket.id == ticket_id:
                return ticket
        raise KeyError(ticket_id)
