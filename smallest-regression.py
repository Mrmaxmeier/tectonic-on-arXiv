import click

from pathlib import Path
from pprint import pprint
import json

def parse(p):
	with open(p) as f:
		for l in f.readlines():
			yield json.loads(l.strip())

@click.command()
@click.argument("a", type=click.Path(exists=True))
@click.argument("b", type=click.Path(exists=True))
@click.option("--engine", default="tectonic")
def compare(a, b, engine):
	print(a, b)
	iA = parse(a)
	iB = parse(b)
	metaA = next(iA)
	metaB = next(iB)
	entriesA = list(iA)
	entriesB = list(iB)

	samples = set([x["sample"] for x in entriesA + entriesB])
	def find(l, i):
		for x in l:
			if x["sample"] == i: return x

	different = set()
	for sample in sorted(samples):
		sA = find(entriesA, sample)
		sB = find(entriesB, sample)
		if not sA or not sB:
			continue
		sA = sA["engines"][engine]
		sB = sB["engines"][engine]
		if sA["statuscode"] != sB["statuscode"]:
			different.add(sample)
		objects = sorted(set(sA['results'].keys()) | set(sB['results'].keys()))
		for k in objects:
			if sA['results'].get(k, None) != sB['results'].get(k, None):
				different.add(sample)
	if not different:
		print("no regressions")
		return
	
	(size, sample) = min([(Path(f"datasets/{metaA['dataset']}/{s}.gz").stat().st_size, s) for s in different])

	sA = find(entriesA, sample)
	sB = find(entriesB, sample)
	sA = sA["engines"][engine]
	sB = sB["engines"][engine]
	if sA["statuscode"] != sB["statuscode"]:
		different.add(sample)
		
	print("sample differs:", sample, f"({size} bytes gz'd)")
	_a = sA["statuscode"]
	_b = sB["statuscode"]
	print("statuscodes:".rjust(18), _a, " = " if _a == _b else " ! ", _b)
	for k in objects:
		_a = sA['results'].get(k, ' ' * 20)
		_b = sB['results'].get(k, ' ' * 20)
		print(_a, " = " if _a == _b else " ! ", _b, k)
	print()

if __name__ == "__main__":
	compare()
