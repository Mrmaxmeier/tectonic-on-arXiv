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

	regressions = defaultdict(set)
	fixes       = defaultdict(set)

	samples = {}

	for el in s:
		sT = el["engines"]["tectonic"]["statuscode"]
		sX = el["engines"]["xelatex"]["statuscode"]
		if sT == sX: continue
		samples[el["sample"]] = el
		if sT != 0:
			regressions[f"{sX} => {sT}"].add(el["sample"])
		if sX != 0:
			fixes[f"{sX} => {sT}"].add(el["sample"])

	print("regressions", sum(map(len, regressions.values())))
	for k, v in regressions.items():
		for x in sorted(v):
			print(x, k, samples[x]["engines"]["tectonic"]["tags"])
	print()
	print("fixes", sum(map(len, fixes.values())))
	for k, v in fixes.items():
		for x in sorted(v):
			print(x, k)

if __name__ == "__main__":
	regressions()
