import click
import json
from collections import Counter, defaultdict
from pprint import pprint

def stream(path):
	with open(path) as f:
		for x in f.readlines():
			yield json.loads(x)

@click.command()
@click.argument("report")
def regressions(report):
	s = stream(report)
	meta = next(s)
	pprint(meta)

	regressions = set()
	fixes       = set()

	samples = {}

	for el in s:
		if el["engines"]["tectonic"]["statuscode"] != el["engines"]["xelatex"]["statuscode"]:
			samples[el["sample"]] = el
			if el["engines"]["tectonic"]["statuscode"] != 0:
				regressions.add(el["sample"])
			if el["engines"]["xelatex"]["statuscode"] != 0:
				fixes.add(el["sample"])
	print("regressions", len(regressions))
	for x in sorted(regressions):
		pprint(samples[x])
	print()
	print("fixes", len(fixes))
	for x in sorted(fixes):
		pprint(samples[x])

if __name__ == "__main__":
	regressions()
