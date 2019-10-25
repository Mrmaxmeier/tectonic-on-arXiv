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
def meta(reports):
    if not reports:
        reports = Path("reports").glob("*.jsonl")
    compatible_samples = set()
    _reports = []
    for r in reports:
        for pkt in stream(r):
            if "name" in pkt or "meta" in pkt:
                _reports.append(pkt)
            elif pkt["statuscode"] == 0:
                compatible_samples.add(pkt["sample"])
    data = dict(reports=_reports, compatible_samples=list(
        sorted(compatible_samples)))
    pprint(data)
    with open("reports/meta.json", "w") as f:
        json.dump(data, f)


if __name__ == "__main__":
    meta()
