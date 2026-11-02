"""Load aws/games.json into the rmgp-games DynamoDB table.

Run it in AWS CloudShell (or with a local `aws configure` profile).
No keys are stored in this file: boto3 reads credentials from the environment.
"""
import json
import sys
from pathlib import Path

import boto3

TABLE = "rmgp-games"
REGION = "us-east-2"
FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("games.json")

games = json.load(open(FILE, encoding="utf-8"))
table = boto3.resource("dynamodb", region_name=REGION).Table(TABLE)

with table.batch_writer() as batch:
    for game in games:
        batch.put_item(Item=game)

stored = table.scan(Select="COUNT")["Count"]
print(f"Wrote {len(games)} games; table now holds {stored} items.")
if stored != len(games):
    sys.exit("Item count does not match the JSON file.")
