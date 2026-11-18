"""Known services and their owners."""
SERVICES = {
    "billing": "payments",
    "ingest": "data-platform",
    "notify": "growth",
    "search": "discovery",
}


def owner(service):
    return SERVICES.get(service, "unowned")
