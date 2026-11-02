# RMGP front page: take-home

A single front page in the style of the [Retro Mobile Gaming Project](https://www.rmgd.org) (RMGP). The page shows 45 real games from the RMGP collection. It has search, filters and a detail view, and the games are served from a small DynamoDB table through a read-only AWS Lambda API. A simple chatbot answers questions about the collection.

- `application/` is the React page (Vite).
- `aws/` holds the games data, the seed script, the Lambda code and the API tests.

## Running the page

You need a recent Node, 20 or later. The page reads its games from the API, so it needs the Lambda Function URL. I'll share the URL with reviewers directly, since it isn't in the repo.

```bash
cd application
npm install
cp .env.example .env.local   # then put the Function URL in API_URL, with no trailing slash
npm run dev
```

Open http://localhost:5173.

In development, Vite forwards `/api` to the Function URL (see `vite.config.js`). The browser only talks to localhost, and the URL stays out of the page code.

**Tests:**

```bash
cd application && npm test                                       # 90 page tests, using a fake API
cd aws && RMGP_API_URL="https://<function-url>/" python3 test_api.py -v   # 72 checks against the live API
```

## What is on the page

| Section | What it does |
|---|---|
| Navbar | A fixed bar with the logo only. It's clear over the hero and turns dark and blurred after 60px of scrolling, as on rmgd.org. |
| Hero | RMGP's video, muted, looping and inline, with the line "Preserving the history of mobile gameplay from 1975 to 2008." The title fades out after about four seconds, as on the live site. |
| From the Archive | Title search; sort (featured, newest, oldest, title); a year slider with decade buttons; a photos-only toggle; and checkbox filters for Type, Platform, Play Style, Connectivity, Players, Origin and Maker, each with live counts. It shows chips for the chosen filters, Clear (n) on each group and Clear all. Results show 8 per page with every page number listed. A clear message and a reset button appear when nothing matches. Clicking a card opens the game in a dialog on the same page, with its photo and all its fields. |
| Images | *In progress.* |
| About | What RMGP is and why preserving early mobile games matters, written in my own words. |
| Collection guide | A chat panel, bottom right. See [Chatbot](#chatbot). |

The layout is built mobile-first. At 375px wide it has no sideways scrolling, and the filter groups and cards stack into one column. The filters, cards, dialog and chat all work with the keyboard. The dialog closes with Esc and puts focus back on the card.

**Order:** the archive comes straight after the hero, as on the live homepage. The brief lists Images before the games. I also left out the live site's "Discover & Explore" section.

## Data

`aws/games.json` holds 45 games. Every record has the same 22 fields:

`id, title, year, yearLabel, decade, device, type, platform, hardware, genre, playStyle, connectivity, players, developer, maker, country, origin, description, image, sourceUrl, featuredRank, sk`

- **Source:** the records come from RMGP's public `/api/games` response, which lists 311 items, and are used for this assignment only.
- **Picks:** 10 games per decade from the 1970s to the 2000s, plus all 5 from the 2010s. I skipped the one record with no year.
  - **Why 45:** the brief asks for 15 to 20. I went above that on purpose, so every filter has several values to show.
  - **How:** I picked them with the same rules the live site uses to build its filters, so they cover as many filter values as possible.
- **Non-games:** some picks, such as calculators, phones, an iPad and a GPS unit, aren't games but are part of the RMGP collection. 11 records have no photo, which is what the photos-only toggle hides.
- **Device and filter fields:** `device` is RMGP's Platform label, or its Type when the Platform is empty. `type`, `playStyle`, `connectivity`, `players`, `origin` and `maker` are cleaned up the same way the live site does it. For example, "USA" and "United States of America" both become "United States".
- **Images:** they aren't copied into the repo. The page shows them from RMGP's own image store.
- **Source link:** RMGP has no page per game, so every `sourceUrl` points to https://www.rmgd.org and `id` is the RMGP record id.

## DynamoDB design

| | |
|---|---|
| Table | `rmgp-games` |
| Region | `us-east-2` (Ohio) |
| Capacity | On-demand, personal account, free tier |
| Partition key | `decade` (String), for example `1980s` |
| Sort key | `sk` (String), `device#id`, for example `Game Boy#bca605de` |
| Items | 45, the same records as `aws/games.json`, checked by `test_api.py` |

**Why these keys:**
- **One device and one decade is a single Query:** `decade = "1980s"` and `begins_with(sk, "Game Boy#")`. That's the access pattern the brief asks for.
- **The partitions are even for this data:** 10, 10, 10, 10 and 5 games. Using device as the partition key would put 15 games in one partition and 1 in many others.
- **A whole decade is one Query** on the partition key alone.
- **The `id` at the end of the sort key** keeps two games on the same device unique.
- **The year isn't in the key.** A year can't be matched by key behind the device anyway, so the Lambda filters exact years after the Query.

**One device and one decade, from the AWS CLI:**

```bash
aws dynamodb query --table-name rmgp-games --region us-east-2 \
  --key-condition-expression "decade = :d AND begins_with(sk, :device)" \
  --expression-attribute-values '{":d":{"S":"1980s"},":device":{"S":"Game Boy#"}}'
```

**The same query with boto3:**

```python
table.query(KeyConditionExpression=Key("decade").eq("1980s") & Key("sk").begins_with("Game Boy#"))
```

**Through the API:** `GET /?decade=1980s&device=Game%20Boy`

**Other filters:**
- A year range runs one Query per decade it touches and then trims to the exact years. There are at most 5 Queries.
- A device-only request, or one with no decade or years, Scans the table. That's fine at 45 items.
- Keyword, checkbox filters, sort and paging run in the Lambda.

**At a larger scale:**
- DynamoDB is built for key lookups, not for free-text search or many filters combined.
- With thousands of games, I would add secondary indexes for the most common single-field lookups, such as device and origin. Each index is another copy of the data.
- I would also move keyword and multi-filter search to a search service such as OpenSearch.
- Five decade partitions would also be too few at that size.

### Loading the table

`aws/seed.py` reads `games.json`, writes every record with boto3's `batch_writer` and checks that the table's item count matches the file. It has no keys in it, because boto3 takes credentials from the environment.

1. In the AWS console, create the table with the keys above and on-demand capacity.
2. Open **AWS CloudShell** in the same region and upload `aws/games.json` and `aws/seed.py`.
3. Run `python3 seed.py`. It prints `Wrote 45 games; table now holds 45 items.`

A screenshot of the table's items is in [`docs/dynamodb-table.png`](docs/dynamodb-table.png).

## API (Lambda)

`aws/lambda_handler.py` runs as the Lambda `rmgp-games-api` (Python) behind a Function URL.

**Parameters:**

`GET /?q=&sort=&year_min=&year_max=&decade=&photos=&type=&device=&play_style=&connectivity=&players=&origin=&maker=&page=`

- Checkbox filters take comma-separated values. Values in one filter are combined with OR, and different filters with AND.
- `q` matches the title, developer, country and description. It ignores case and accents, so "pokemon" finds "Pokémon".

**Response:**
- `total`, `page`, `pageSize` (8), `pages` and `items`
- `facets`: the options and counts for each filter. Each filter's counts ignore its own selection, as on rmgd.org.
- `meta`: the year span and decades, used to size the slider and the decade buttons

**Security:**
- **No keys:** there are no AWS keys anywhere in the repo, the screenshots or the page code.
- **Permissions:** the table access comes from an inline policy that allows only `dynamodb:Query` and `dynamodb:Scan` on this one table. The Lambda currently runs as my account's PowerUserRole, which carries that policy. A dedicated role is listed under next steps.
- **Public URL:** the Function URL uses auth type NONE and can only read public RMGP data. It's shared with reviewers only, it isn't in the repo, and an AWS budget alert is set.
- **CORS:** the Function URL doesn't send CORS headers. Locally, that's handled by the Vite proxy.

## Chatbot

The "Collection guide" (`application/src/components/Chat/`) copies the look of the live site's chat, Pixel. It uses **no AI model and no keys**:
1. `parseQuestion.js` reads the question for:
   - decades, such as "1980s", "'90s" or "eighties"
   - years, year ranges, and "before" or "after" a year
   - two-player or one-player wording, and "with photos"
   - any filter value in the collection, such as a device, a country or a maker, plus a few everyday words like "phone" or "japanese"
   - the remaining words, which become a title search
2. It calls the same API as the archive.
3. `buildAnswer.js` replies only from the API's answer, so it can't name a game that isn't in the collection.
   - It lists up to 8 games, or gives the full record when exactly one game matches, or a count for "how many" questions.
   - When nothing matches it says **"That isn't in this collection."** If the title is close to a real one, it offers "Did you mean…?" buttons, for example "lemings" → Lemmings.

Example questions: "Which games are from the 1980s?", "Which games are for two players?", "Games from Japan in the 1990s", "How many phone games are there?" and "Who made Snake?".

**Limits:** it doesn't understand follow-up questions such as "and in the 1990s?", and it isn't open conversation.

## What I would do next

- Serve the built page from S3 and CloudFront, and turn on CORS for the Function URL, or put API Gateway in front of the Lambda with a usage limit.
- Give the chatbot follow-up questions, a "Show these in the archive" button that applies its filters to the page, and clickable game names that open the detail dialog.
- Give the Lambda its own execution role that allows only the two read actions, in place of the PowerUserRole it uses today.
- Add per-game pages on RMGP, so each record's `sourceUrl` can point to the game itself.
- Add secondary indexes, or a search service, if the collection grows past a few hundred games.
- Run browser end-to-end tests, for example with Playwright, to check layout and scrolling, which the simulated browser in the page tests can't.

## What I left out

- The live site's "Discover & Explore" section, its navigation links and the "See also" carousel in its game detail view.
- The voice input on the live chat, and any AI-model answers.
- Copies of the images in the repo. They're shown from RMGP's image store.

## Credits

- **RMGP:** the game data, the photos and the hero video are from the Retro Mobile Gaming Project (https://www.rmgd.org) and are used for this assignment only. The page's layout and colours follow rmgd.org.
- **Font:** Geist and Geist Mono, from Fontsource.
- **AI help:** built with help from Claude Code, an AI coding assistant, which also drafted the About text.

## Time spent

_To be filled in honestly by the author._

## After the interview

Delete the DynamoDB table, the Lambda function and its Function URL.
