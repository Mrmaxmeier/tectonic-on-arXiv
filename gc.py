import click
import json
from pathlib import Path
from pprint import pprint

def stream(p):
	with open(p) as f:
		for l in f.readlines():
			yield json.loads(l)

@click.command()
@click.argument("reports", nargs=-1)
def gc(reports):
	live = set()
	for r in reports:
		for pkt in stream(r):
			for _, data in pkt.get("engines", {}).items():
				live.update(data["results"].values())
	files = set([x.name for x in Path("objects").iterdir() if x.is_file()])
	dead = files - live
	print("files:", len(files))
	print(" live:", len(live))
	print(" dead:", len(dead))
	if dead and click.confirm('Confirm GC?'):
		for x in dead:
			click.echo('rip ' + x)
			(Path("objects") / x).unlink()


if __name__ == "__main__":
	gc()
