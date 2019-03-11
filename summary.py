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
def summary(report):
	s = stream(report)
	meta = next(s)
	pprint(meta)

	engines = ["tectonic", "xelatex"]

	geomeanCount = 0
	geomean = defaultdict(lambda: 1)
	worstSpeed = defaultdict(lambda: (0.0, None))
	statuscodes = defaultdict(Counter)
	tags = defaultdict(Counter)

	for el in s:
		for eng, data in el["engines"].items():
			if eng not in engines: continue
			statuscodes[eng].update([data["statuscode"]])
			if data["tags"]:
				tags[data["statuscode"]].update(data["tags"])
		if all([x["statuscode"] == 0 for x in el["engines"].values()]):
			for eng, data in el["engines"].items():
				if eng not in engines: continue
				geomean[eng] *= data["seconds"]
				if worstSpeed[eng][0] <= data["seconds"]:
					worstSpeed[eng] = (data["seconds"], el["sample"])
			geomeanCount += 1

	print("average build time:")
	for eng in engines:
		print(eng.rjust(9), geomean[eng] ** (1/geomeanCount))
	print("worst build time:")
	for eng in engines:
		print(eng.rjust(9), worstSpeed[eng])
	print("status codes:")
	for eng in engines:
		print(eng.rjust(9), statuscodes[eng])

	print("tags by statuscode:")
	for k, v in tags.items():
		print(" ", k, ":", v)

if __name__ == "__main__":
	summary()
