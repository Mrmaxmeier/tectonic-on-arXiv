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

    geomeanCount = 0
    geomean = 1
    worstSpeed = (0.0, None)
    statuscodes = Counter()
    tags = Counter()

    for el in s:
        statuscodes.update([el["statuscode"]])
        if "tags" in el:
            tags[el["statuscode"]].update(el["tags"])
        geomean *= el["seconds"]
        if worstSpeed[0] <= el["seconds"]:
            worstSpeed = (el["seconds"], el["sample"])
        geomeanCount += 1

    print("average build time:")
    print(geomean ** (1/geomeanCount))
    print("worst build time:")
    print(worstSpeed)
    print("status codes:")
    print(statuscodes)

    print("tags by statuscode:")
    for k, v in tags.items():
        print(" ", k, ":", v)


if __name__ == "__main__":
    summary()
