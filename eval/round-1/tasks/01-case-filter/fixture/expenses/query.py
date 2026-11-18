"""Category filtering for the dashboard."""


def filter_by_category(rows, category):
    """Return the rows in one category, ordered by id."""
    wanted = category.strip()
    return sorted(
        (row for row in rows if row["category"].strip() == wanted),
        key=lambda row: row["id"],
    )
