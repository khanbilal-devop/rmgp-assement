"""Read-only API for the RMGP games table (AWS Lambda behind a Function URL).

GET /?q=&sort=&year_min=&year_max=&decade=&photos=&type=&device=&play_style=
     &connectivity=&players=&origin=&maker=&page=

Checkbox filters take comma-separated values (OR inside one filter, AND across filters).
The table keys speed up the decade lookup: one Query per decade partition, plus
begins_with on the sort key when exactly one device is chosen. With no decade or year
range the table is Scanned, which is fine at this size. Everything else is filtered in code.
"""
import json
import unicodedata
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

TABLE = "rmgp-games"
REGION = "us-east-2"
PAGE_SIZE = 8
DECADES = [1970, 1980, 1990, 2000, 2010]

# query-string name -> item field
FACETS = {
    "type": "type",
    "device": "device",
    "play_style": "playStyle",
    "connectivity": "connectivity",
    "players": "players",
    "origin": "origin",
    "maker": "maker",
}

table = boto3.resource("dynamodb", region_name=REGION).Table(TABLE)


def as_list(value):
    return value if isinstance(value, list) else [value] if value else []


def split(value):
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def decades_to_read(params):
    """Decade partitions the request touches, or None to Scan."""
    if params.get("decade"):
        return [params["decade"]]
    if params.get("year_min") or params.get("year_max"):
        low = int(params.get("year_min") or DECADES[0])
        high = int(params.get("year_max") or DECADES[-1] + 9)
        return [f"{d}s" for d in range(low // 10 * 10, high // 10 * 10 + 1, 10)]
    return None


def read_table(params):
    decades = decades_to_read(params)
    items = []
    if decades is None:
        response = table.scan()
        items = response["Items"]
        while "LastEvaluatedKey" in response:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items += response["Items"]
        return items
    devices = split(params.get("device"))
    for decade in decades:
        condition = Key("decade").eq(decade)
        if len(devices) == 1:
            condition &= Key("sk").begins_with(devices[0] + "#")
        response = table.query(KeyConditionExpression=condition)
        items += response["Items"]
        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression=condition,
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items += response["Items"]
    return items


def fold(text):
    """Lower-case text with accents removed, so "pokemon" matches "Pokémon"."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def matches(item, params, skip=None):
    q = fold(params.get("q") or "")
    if q:
        text = fold(f"{item['title']} {item['developer']} {item['country']} {item['description']}")
        if q not in text:
            return False
    if params.get("year_min") and item["year"] < int(params["year_min"]):
        return False
    if params.get("year_max") and item["year"] > int(params["year_max"]):
        return False
    if params.get("decade") and item["decade"] != params["decade"]:
        return False
    if params.get("photos") == "true" and not item["image"]:
        return False
    for name, field in FACETS.items():
        chosen = split(params.get(name))
        if name != skip and chosen and not set(chosen) & set(as_list(item[field])):
            return False
    return True


def facet_counts(items, params):
    """Counts per option, ignoring that facet's own selection (as the live site does)."""
    result = {}
    for name, field in FACETS.items():
        counts = {}
        for item in items:
            if matches(item, params, skip=name):
                for value in as_list(item[field]):
                    counts[value] = counts.get(value, 0) + 1
        result[name] = [
            {"value": v, "count": c}
            for v, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ]
    return result


def sort_items(items, order):
    if order == "newest":
        return sorted(items, key=lambda i: -i["year"])
    if order == "oldest":
        return sorted(items, key=lambda i: i["year"])
    if order == "title":
        return sorted(items, key=lambda i: i["title"].lower())
    return sorted(items, key=lambda i: i["featuredRank"])


def collection_meta(items):
    """Year span and decades of the games read, so the page can size its year slider and buttons."""
    if not items:
        return {"yearMin": None, "yearMax": None, "decades": []}
    years = [item["year"] for item in items]
    return {
        "yearMin": min(years),
        "yearMax": max(years),
        "decades": sorted({item["decade"] for item in items}),
    }


def search(items, params):
    found = sort_items([i for i in items if matches(i, params)], params.get("sort"))
    page = max(1, int(params.get("page") or 1))
    start = (page - 1) * PAGE_SIZE
    return {
        "total": len(found),
        "page": page,
        "pageSize": PAGE_SIZE,
        "pages": max(1, -(-len(found) // PAGE_SIZE)),
        "items": found[start:start + PAGE_SIZE],
        "facets": facet_counts(items, params),
        "meta": collection_meta(items),
    }


def number_default(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    try:
        # Read the partitions the decade/year filters need, then filter in code.
        items = read_table(params)
        body = search(items, params)
        status = 200
    except ValueError:
        body, status = {"error": "year_min, year_max and page must be numbers"}, 400
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=number_default),
    }
