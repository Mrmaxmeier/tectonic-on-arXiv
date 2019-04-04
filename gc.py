import click
import json
from pathlib import Path
from pprint import pprint
from collections import defaultdict

def stream(p):
	with open(p) as f:
		for l in f.readlines():
			yield json.loads(l)

@click.command()
@click.argument("reports", nargs=-1)
def gc(reports):
	if not reports:
		reports = list(Path("reports").glob("*.jsonl"))
	live = set()
	uniques = defaultdict(set)
	notUniques = defaultdict(set)
	def updateUniques(r, vals):
		uniques[r].update(vals)
		for rep in reports:
			if rep != r:
				notUniques[rep].update(vals)
	for r in reports:
		for pkt in stream(r):
			for _, data in pkt.get("engines", {}).items():
				if data["results"]:
					live.update(data["results"].values())
					updateUniques(r, data["results"].values())
	files = set([x.name for x in Path("objects").iterdir() if x.is_file()])
	files -= set([".gitignore"])
	objectSize = lambda objs: str(int(sum([(Path('objects') / x).stat().st_size for x in objs]) / 2**20)) + " MB"
	print(f"objects: {len(files)} - {objectSize(files)}")
	uniques = {k: v - notUniques[k] for k, v in uniques.items()}
	print("unique artifact sizes")
	shared = set(files)
	for r in reports:
		print(objectSize(uniques[r]), r)
		shared -= uniques[r]
	print(objectSize(shared), "shared")

	missing = live - files
	live &= files
	dead = files - live
	print("files:", len(files), objectSize(files))
	if missing:
		print("  404:", len(missing))
	print(" live:", len(live), objectSize(live))
	print(" dead:", len(dead), objectSize(dead))
	if dead and click.confirm('Confirm GC?'):
		for x in dead:
			click.echo('rip ' + x)
			(Path("objects") / x).unlink()
	else:
		for x in dead:
			click.echo("dead: " + x)


if __name__ == "__main__":
	gc()
