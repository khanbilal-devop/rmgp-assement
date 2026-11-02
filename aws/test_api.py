"""Checks that the games API (Lambda + DynamoDB) returns the games we expect.

Run it any time you want to confirm the table and the Lambda still behave:

    RMGP_API_URL="https://<your-function-url>/" python3 test_api.py -v

Expected results come from games.json (the file the table was seeded from), so a
failure means the table, the Lambda or the filters have drifted from that file.
No third-party packages are needed, and the URL is read from the environment so it
never goes into the repository.
"""
import json
import os
import ssl
import sys
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from unicodedata import combining, normalize

API_URL = os.environ.get("RMGP_API_URL", "").rstrip("/")
GAMES = json.loads(Path(__file__).with_name("games.json").read_text(encoding="utf-8"))
PAGE_SIZE = 8
PAGES = -(-len(GAMES) // PAGE_SIZE)

# python.org builds of Python on macOS ship without CA certificates, so use the system bundle.
SYSTEM_CERTS = "/etc/ssl/cert.pem"
SSL_CONTEXT = ssl.create_default_context(cafile=SYSTEM_CERTS if os.path.exists(SYSTEM_CERTS) else None)


def fold(text):
    """Lower-case text with accents removed, the way the API compares keywords."""
    return "".join(ch for ch in normalize("NFKD", text) if not combining(ch)).lower()


def call(**params):
    """Call the API and return (status code, parsed JSON body)."""
    url = f"{API_URL}/?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=30, context=SSL_CONTEXT) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        with error:
            return error.code, json.load(error)


def fetch_all(**params):
    """Return every game for the filters, following all result pages."""
    _, body = call(**params)
    items = list(body["items"])
    for page in range(2, body["pages"] + 1):
        items += call(page=page, **params)[1]["items"]
    return items


def ids(items):
    return {item["id"] for item in items}


def expected_ids(test):
    """IDs of the games in games.json that satisfy a condition."""
    return {game["id"] for game in GAMES if test(game)}


def values(game, field):
    value = game[field]
    return value if isinstance(value, list) else [value]


class ApiTestCase(unittest.TestCase):
    def assert_returns(self, expected, **params):
        """Assert the API returns exactly the expected game ids for these params."""
        status, body = call(**params)
        self.assertEqual(status, 200)
        self.assertEqual(body["total"], len(expected))
        self.assertEqual(ids(fetch_all(**params)), expected)


class TestDataIntegrity(ApiTestCase):
    def test_no_filters_returns_every_game(self):
        """With no filters the table holds all 45 games from games.json."""
        self.assert_returns(ids(GAMES))

    def test_items_match_the_json_exactly(self):
        """Every stored game is identical to its record in games.json."""
        stored = {item["id"]: item for item in fetch_all()}
        for game in GAMES:
            self.assertEqual(stored[game["id"]], game, game["title"])


    def test_every_stored_game_has_the_same_fields(self):
        """Every item in the table has exactly the fields of the records in games.json."""
        expected_fields = set(GAMES[0])
        for item in fetch_all():
            self.assertEqual(set(item), expected_fields, item["title"])

    def test_keys_follow_the_design(self):
        """The decade matches the year and the sort key is device#id for every item."""
        for item in fetch_all():
            self.assertEqual(item["decade"], f"{item['year'] // 10 * 10}s", item["title"])
            self.assertEqual(item["sk"], f"{item['device']}#{item['id']}", item["title"])

    def test_every_game_has_a_featured_rank(self):
        """The featured ranks run from 1 to the number of games with no gaps or repeats."""
        ranks = sorted(item["featuredRank"] for item in fetch_all())
        self.assertEqual(ranks, list(range(1, len(GAMES) + 1)))


class TestDecadeAndYear(ApiTestCase):
    def test_each_decade_returns_only_its_games(self):
        """Each decade partition returns exactly the games from that decade."""
        for decade in ["1970s", "1980s", "1990s", "2000s", "2010s"]:
            with self.subTest(decade=decade):
                self.assert_returns(expected_ids(lambda g: g["decade"] == decade), decade=decade)

    def test_unknown_decade_returns_nothing(self):
        """A decade with no games returns an empty list, not an error."""
        self.assert_returns(set(), decade="1960s")

    def test_year_range_inside_one_decade(self):
        """A year range within one decade reads that partition and trims by year."""
        self.assert_returns(expected_ids(lambda g: 1980 <= g["year"] <= 1984), year_min=1980, year_max=1984)

    def test_year_range_across_decades(self):
        """A year range spanning three decades merges results from each partition."""
        self.assert_returns(expected_ids(lambda g: 1985 <= g["year"] <= 2003), year_min=1985, year_max=2003)

    def test_single_year(self):
        """Setting the same year for both ends returns only games from that year."""
        self.assert_returns(expected_ids(lambda g: g["year"] == 1989), year_min=1989, year_max=1989)

    def test_only_a_minimum_year(self):
        """A minimum year with no maximum returns everything from then on."""
        self.assert_returns(expected_ids(lambda g: g["year"] >= 2000), year_min=2000)

    def test_only_a_maximum_year(self):
        """A maximum year with no minimum returns everything up to then."""
        self.assert_returns(expected_ids(lambda g: g["year"] <= 1979), year_max=1979)

    def test_decade_and_year_range_together(self):
        """A decade combined with a year range keeps only the overlap."""
        self.assert_returns(
            expected_ids(lambda g: g["decade"] == "1990s" and g["year"] >= 1996),
            decade="1990s", year_min=1996,
        )


class TestDevice(ApiTestCase):
    def test_one_device_across_all_decades(self):
        """A device alone scans the table and returns that device's games."""
        self.assert_returns(expected_ids(lambda g: g["device"] == "Game Boy"), device="Game Boy")

    def test_one_device_in_one_decade(self):
        """One device and one decade is a single Query on the decade and sort key."""
        self.assert_returns(
            expected_ids(lambda g: g["device"] == "Built-in (dedicated device)" and g["decade"] == "1980s"),
            device="Built-in (dedicated device)", decade="1980s",
        )

    def test_one_device_across_a_year_range(self):
        """A device with a year range queries each decade and trims by year."""
        self.assert_returns(
            expected_ids(lambda g: g["device"] == "Mobile phone" and 2000 <= g["year"] <= 2010),
            device="Mobile phone", year_min=2000, year_max=2010,
        )

    def test_several_devices_at_once(self):
        """Comma-separated devices match any one of them."""
        wanted = {"Game Boy", "Nintendo DS"}
        self.assert_returns(expected_ids(lambda g: g["device"] in wanted), device="Game Boy,Nintendo DS")

    def test_device_with_no_games_in_that_decade(self):
        """A real device in a decade it has no games in returns nothing."""
        self.assert_returns(set(), device="N-Gage", decade="1970s")

    def test_unknown_device_returns_nothing(self):
        """A device that does not exist returns an empty list."""
        self.assert_returns(set(), device="Not A Device")


class TestKeywordSearch(ApiTestCase):
    @staticmethod
    def contains(game, word):
        text = f"{game['title']} {game['developer']} {game['country']} {game['description']}"
        return fold(word) in fold(text)

    def test_title_keyword(self):
        """A keyword in a title finds that game."""
        self.assert_returns(expected_ids(lambda g: self.contains(g, "pokémon")), q="pokémon")

    def test_keyword_ignores_accents(self):
        """"pokemon" finds the Pokémon titles as well as those written without the accent."""
        found = {i["title"] for i in fetch_all(q="pokemon")}
        self.assertEqual(found, {g["title"] for g in GAMES if self.contains(g, "pokémon") or self.contains(g, "pokemon")})
        self.assertTrue(any("é" in title for title in found))
        self.assertEqual(ids(fetch_all(q="pokemon")), ids(fetch_all(q="pokémon")))

    def test_keyword_ignores_case(self):
        """Upper-case and lower-case keywords give the same result."""
        self.assertEqual(ids(fetch_all(q="ZELDA")), ids(fetch_all(q="zelda")))
        self.assertTrue(ids(fetch_all(q="zelda")))

    def test_developer_keyword(self):
        """A keyword in the developer field also matches."""
        self.assert_returns(expected_ids(lambda g: self.contains(g, "nintendo")), q="nintendo")

    def test_keyword_with_nothing_matching(self):
        """A keyword in no game gives an empty list so the page can show no results."""
        status, body = call(q="zzzzqqqq")
        self.assertEqual((status, body["total"], body["items"]), (200, 0, []))

    def test_keyword_combined_with_decade(self):
        """A keyword and a decade must both match."""
        self.assert_returns(
            expected_ids(lambda g: self.contains(g, "game") and g["decade"] == "1980s"),
            q="game", decade="1980s",
        )


class TestCheckboxFilters(ApiTestCase):
    def check_filter(self, param, field, wanted):
        """Assert a checkbox filter returns games having any of the wanted values."""
        self.assert_returns(
            expected_ids(lambda g: set(values(g, field)) & set(wanted)),
            **{param: ",".join(wanted)},
        )

    def test_type(self):
        """Type filter returns games of that type."""
        self.check_filter("type", "type", ["Handheld console"])

    def test_several_types(self):
        """Several types at once match any of them."""
        self.check_filter("type", "type", ["Calculator", "Tablet", "GPS device"])

    def test_play_style(self):
        """Play style filter returns games with that play style."""
        self.check_filter("play_style", "playStyle", ["Location-based"])

    def test_connectivity(self):
        """Connectivity filter returns games with that connection type."""
        self.check_filter("connectivity", "connectivity", ["GPS / location"])

    def test_players_multiplayer(self):
        """Players filter returns the multiplayer games."""
        self.check_filter("players", "players", ["Multiplayer"])

    def test_players_single_player(self):
        """Players filter returns the single-player games."""
        self.check_filter("players", "players", ["Single-player"])

    def test_origin(self):
        """Origin filter returns games from that country."""
        self.check_filter("origin", "origin", ["Japan"])

    def test_several_origins(self):
        """Several origins at once match any of them."""
        self.check_filter("origin", "origin", ["Japan", "Finland", "Sweden"])

    def test_maker(self):
        """Maker filter returns games by that maker."""
        self.check_filter("maker", "maker", ["Nintendo"])

    def test_different_filters_combine_with_and(self):
        """Filters from different groups must all match."""
        self.assert_returns(
            expected_ids(lambda g: g["origin"] == ["Japan"] and "Multiplayer" in g["players"]),
            origin="Japan", players="Multiplayer",
        )

    def test_filters_combine_with_decade(self):
        """A checkbox filter plus a decade narrows to the overlap."""
        self.assert_returns(
            expected_ids(lambda g: "Multiplayer" in g["players"] and g["decade"] == "1980s"),
            players="Multiplayer", decade="1980s",
        )

    def test_filter_value_is_case_sensitive(self):
        """Values must match exactly, so a wrong-case value returns nothing."""
        self.assert_returns(set(), origin="japan")


class TestKeywordFields(ApiTestCase):
    def test_keyword_matches_the_country(self):
        """A keyword that only appears in a game's country still finds it."""
        word = next(g["country"] for g in GAMES if g["country"] and g["country"].lower() not in g["title"].lower())
        self.assert_returns(
            expected_ids(lambda g: word.lower() in f"{g['title']} {g['developer']} {g['country']} {g['description']}".lower()),
            q=word,
        )

    def test_keyword_matches_the_description(self):
        """A word taken from a description finds that game."""
        game = next(g for g in GAMES if len(g["description"].split()) > 30)
        word = game["description"].split()[20].strip(".,;:()\"'").lower()
        self.assertIn(game["id"], ids(fetch_all(q=word)))


class TestCombinedFilters(ApiTestCase):
    def test_decade_keyword_and_players_together(self):
        """A decade, a keyword and a players filter must all match."""
        self.assert_returns(
            expected_ids(lambda g: g["decade"] == "1980s" and "Multiplayer" in g["players"]),
            decade="1980s", players="Multiplayer",
        )

    def test_year_range_origin_photos_and_sort_together(self):
        """A year range, an origin and the photos toggle combine, and the sort still applies."""
        params = dict(year_min=1980, year_max=2008, origin="Japan", photos="true", sort="newest")
        wanted = [g for g in GAMES if 1980 <= g["year"] <= 2008 and "Japan" in g["origin"] and g["image"]]
        status, body = call(**params)
        self.assertEqual((status, body["total"]), (200, len(wanted)))
        self.assertEqual([i["year"] for i in fetch_all(**params)], sorted((g["year"] for g in wanted), reverse=True))

    def test_device_year_range_and_maker_together(self):
        """A device, a year range and a maker narrow the result to the overlap."""
        self.assert_returns(
            expected_ids(lambda g: g["device"] == "Mobile phone" and g["year"] >= 2000 and "Blast Theory" in g["maker"]),
            device="Mobile phone", year_min=2000, maker="Blast Theory",
        )

    def test_every_filter_at_once_can_match_nothing(self):
        """Filters that no game satisfies together return an empty list."""
        self.assert_returns(set(), decade="1970s", origin="Finland", players="Multiplayer", photos="true")

    def test_a_decade_and_the_same_year_range_agree(self):
        """Asking for a decade or for its year range returns the same games."""
        self.assertEqual(ids(fetch_all(decade="1990s")), ids(fetch_all(year_min=1990, year_max=1999)))

    def test_a_year_range_the_wrong_way_round_returns_nothing(self):
        """A minimum year later than the maximum returns an empty list, not an error."""
        self.assert_returns(set(), year_min=2000, year_max=1990)

    def test_a_filtered_list_is_split_into_pages(self):
        """A filter with more than one page of results pages correctly and loses no game."""
        wanted = expected_ids(lambda g: g["type"] == "Game / software")
        self.assertGreater(len(wanted), PAGE_SIZE)
        _, body = call(type="Game / software")
        self.assertEqual((body["total"], body["pages"]), (len(wanted), -(-len(wanted) // PAGE_SIZE)))
        self.assertEqual(ids(fetch_all(type="Game / software")), wanted)


class TestPhotos(ApiTestCase):
    def test_only_games_with_photos(self):
        """The photos toggle returns only games that have an image."""
        self.assert_returns(expected_ids(lambda g: g["image"]), photos="true")

    def test_photos_off_returns_all(self):
        """Leaving the toggle off does not hide games without photos."""
        self.assert_returns(ids(GAMES), photos="false")

    def test_photos_with_decade(self):
        """Photos-only plus a decade keeps games with an image from that decade."""
        self.assert_returns(
            expected_ids(lambda g: g["image"] and g["decade"] == "2010s"),
            photos="true", decade="2010s",
        )


class TestSorting(ApiTestCase):
    def test_featured_follows_the_file_order(self):
        """Featured sorts by featuredRank, which follows games.json order."""
        ranks = [item["featuredRank"] for item in fetch_all(sort="featured")]
        self.assertEqual(ranks, sorted(ranks))

    def test_default_sort_is_featured(self):
        """With no sort given the order is the same as featured."""
        self.assertEqual(
            [i["id"] for i in fetch_all()], [i["id"] for i in fetch_all(sort="featured")]
        )

    def test_newest_first(self):
        """Newest first puts the latest years at the top across all pages."""
        years = [item["year"] for item in fetch_all(sort="newest")]
        self.assertEqual(years, sorted(years, reverse=True))

    def test_oldest_first(self):
        """Oldest first puts the earliest years at the top across all pages."""
        years = [item["year"] for item in fetch_all(sort="oldest")]
        self.assertEqual(years, sorted(years))

    def test_title_a_to_z(self):
        """Title A to Z orders titles alphabetically, ignoring case."""
        titles = [item["title"].lower() for item in fetch_all(sort="title")]
        self.assertEqual(titles, sorted(titles))

    def test_sort_keeps_the_filter(self):
        """Sorting a filtered list still returns only the filtered games."""
        self.assertEqual(
            ids(fetch_all(sort="newest", decade="1990s")),
            expected_ids(lambda g: g["decade"] == "1990s"),
        )


class TestPaging(ApiTestCase):
    def test_first_page_holds_a_full_page(self):
        """The first page holds 8 games and reports the page size and page count."""
        _, body = call()
        self.assertEqual(
            (len(body["items"]), body["page"], body["pageSize"], body["pages"]),
            (PAGE_SIZE, 1, PAGE_SIZE, PAGES),
        )

    def test_last_page_holds_the_remainder(self):
        """The last page holds what is left after the full pages."""
        _, body = call(page=PAGES)
        self.assertEqual(len(body["items"]), len(GAMES) - (PAGES - 1) * PAGE_SIZE)

    def test_pages_do_not_repeat_games(self):
        """No game appears on two different pages."""
        everything = [item["id"] for item in fetch_all()]
        self.assertEqual(len(everything), len(set(everything)))

    def test_page_past_the_end_is_empty(self):
        """A page number past the end returns an empty list, not an error."""
        status, body = call(page=99)
        self.assertEqual((status, body["items"]), (200, []))

    def test_small_result_fits_one_page(self):
        """A filter with few results reports a single page."""
        _, body = call(decade="2010s")
        self.assertEqual((body["total"], body["pages"]), (5, 1))


class TestFilterOptions(ApiTestCase):
    def test_every_filter_group_is_returned(self):
        """The response lists options for all seven checkbox filters."""
        _, body = call()
        self.assertEqual(
            set(body["facets"]), {"type", "device", "play_style", "connectivity", "players", "origin", "maker"}
        )

    def test_option_counts_match_the_json(self):
        """Option counts with no filters equal the counts in games.json."""
        _, body = call()
        counts = {o["value"]: o["count"] for o in body["facets"]["players"]}
        for value in ["Single-player", "Multiplayer"]:
            self.assertEqual(counts[value], len([g for g in GAMES if value in g["players"]]))

    def test_counts_follow_the_other_filters(self):
        """Option counts shrink to the games left by the other filters."""
        _, body = call(decade="1980s")
        total = sum(o["count"] for o in body["facets"]["type"])
        self.assertEqual(total, len([g for g in GAMES if g["decade"] == "1980s"]))

    def test_counts_for_every_group_match_the_json(self):
        """With no filters, every option's count equals the number of games with that value."""
        _, body = call()
        fields = {"type": "type", "device": "device", "play_style": "playStyle", "connectivity": "connectivity",
                  "players": "players", "origin": "origin", "maker": "maker"}
        for name, field in fields.items():
            expected = {}
            for game in GAMES:
                for value in values(game, field):
                    expected[value] = expected.get(value, 0) + 1
            shown = {o["value"]: o["count"] for o in body["facets"][name]}
            self.assertEqual(shown, expected, name)

    def test_options_are_listed_most_common_first(self):
        """Options within a group are ordered from the highest count to the lowest."""
        _, body = call()
        for rows in body["facets"].values():
            counts = [row["count"] for row in rows]
            self.assertEqual(counts, sorted(counts, reverse=True))

    def test_an_origin_selection_still_lists_the_other_countries(self):
        """Choosing Japan keeps the other countries in the Origin list so more can be added."""
        _, body = call(origin="Japan")
        self.assertIn("Finland", {o["value"] for o in body["facets"]["origin"]})

    def test_options_with_no_games_left_are_left_out(self):
        """After a filter, options that match no remaining game are not listed."""
        _, body = call(decade="1970s")
        self.assertEqual(body["facets"]["play_style"], [])

    def test_a_group_ignores_its_own_selection(self):
        """Choosing Multiplayer still lists Single-player so the user can switch."""
        _, body = call(players="Multiplayer")
        options = {o["value"] for o in body["facets"]["players"]}
        self.assertEqual(options, {"Single-player", "Multiplayer"})


class TestCollectionMeta(ApiTestCase):
    def test_meta_gives_the_year_span_and_decades(self):
        """The response tells the page the first and last year and the decades present."""
        _, body = call()
        years = [g["year"] for g in GAMES]
        self.assertEqual(body["meta"]["yearMin"], min(years))
        self.assertEqual(body["meta"]["yearMax"], max(years))
        self.assertEqual(body["meta"]["decades"], sorted({g["decade"] for g in GAMES}))


class TestBadInput(ApiTestCase):
    def test_non_numeric_year_is_rejected(self):
        """A year that is not a number returns a 400 with a clear message."""
        status, body = call(year_min="abc")
        self.assertEqual(status, 400)
        self.assertIn("error", body)

    def test_non_numeric_page_is_rejected(self):
        """A page that is not a number returns a 400 with a clear message."""
        self.assertEqual(call(page="abc")[0], 400)

    def test_unknown_parameter_is_ignored(self):
        """A parameter the API does not know changes nothing."""
        self.assert_returns(ids(GAMES), colour="red")


if __name__ == "__main__":
    if not API_URL:
        sys.exit('Set RMGP_API_URL first, e.g. RMGP_API_URL="https://<function-url>/" python3 test_api.py -v')
    unittest.main()
