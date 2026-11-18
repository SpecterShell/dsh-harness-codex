"""Hidden checks for task 10: tag filter plus pagination."""
from items.handler import handle


def ids(result):
    return [item["id"] for item in result["body"]["items"]]


assert handle("GET", "/items")["body"]["total"] == 8, handle("GET", "/items")
assert ids(handle("GET", "/items")) == [1, 2, 3, 4, 5, 6, 7, 8]
assert set(handle("GET", "/items")["body"]) == {"items", "total"}

office = handle("GET", "/items", {"tag": "office"})
assert office["status"] == 200
assert ids(office) == [1, 2, 6], ids(office)
assert office["body"]["total"] == 3, office
assert {item["tag"] for item in office["body"]["items"]} == {"office"}

api = handle("GET", "/items", {"tag": "api"})
assert ids(api) == [5, 8], ids(api)
assert api["body"]["total"] == 2

missing = handle("GET", "/items", {"tag": "nope"})
assert missing["status"] == 200
assert missing["body"] == {"items": [], "total": 0}, missing

page = handle("GET", "/items", {"limit": "2"})
assert ids(page) == [1, 2], ids(page)
assert page["body"]["total"] == 8

page = handle("GET", "/items", {"limit": "2", "offset": "2"})
assert ids(page) == [3, 4], ids(page)
assert page["body"]["total"] == 8

tail = handle("GET", "/items", {"offset": "6"})
assert ids(tail) == [7, 8], ids(tail)
assert tail["body"]["total"] == 8

combined = handle("GET", "/items", {"tag": "desk", "limit": "1", "offset": "1"})
assert ids(combined) == [4], ids(combined)
assert combined["body"]["total"] == 3, combined

beyond = handle("GET", "/items", {"limit": "2", "offset": "99"})
assert beyond["body"] == {"items": [], "total": 8}, beyond

for bad in ({"limit": "0"}, {"limit": "51"}, {"limit": "abc"}, {"limit": "2.5"},
            {"limit": "-1"}, {"offset": "-1"}, {"offset": "abc"}):
    result = handle("GET", "/items", bad)
    assert result["status"] == 400, (bad, result)
    assert isinstance(result["body"].get("error"), str), (bad, result)

assert handle("GET", "/items", {"tag": "desk", "limit": "50"})["body"]["total"] == 3
assert handle("GET", "/items", {"tag": "desk", "bogus": "x"})["body"]["total"] == 3
print("hidden API checks ok")
