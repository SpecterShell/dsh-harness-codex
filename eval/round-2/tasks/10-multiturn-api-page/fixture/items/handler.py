from .store import load_items


def response(status, body):
    return {"status": status, "body": body}


def handle(method, path, query=None):
    query = query or {}
    if method != "GET":
        return response(405, {"error": "method not allowed"})
    if path == "/items":
        return response(200, {"items": load_items()})
    return response(404, {"error": "not found"})
