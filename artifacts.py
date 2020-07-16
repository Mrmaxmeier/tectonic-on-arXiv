import click

from pprint import pprint
import json
import shutil
import os
import subprocess


def parse(p):
    with open(p) as f:
        for l in f.readlines():
            yield json.loads(l.strip())


@click.command()
@click.argument("a", type=click.Path(exists=True))
@click.argument("b", type=click.Path(exists=True))
@click.argument("sample")
def artifacts(a, b, sample):
    print(a, b)
    iA = parse(a)
    iB = parse(b)
    _metaA = next(iA)
    _metaB = next(iB)
    entriesA = list(iA)
    entriesB = list(iB)

    def find(l, i):
        for x in l:
            if x["sample"] == i:
                return x

    sA = find(entriesA, sample)
    sB = find(entriesB, sample)
    assert sA
    assert sB

    shutil.rmtree("/tmp/artA", ignore_errors=True)
    shutil.rmtree("/tmp/artB", ignore_errors=True)
    os.mkdir("/tmp/artA")
    os.mkdir("/tmp/artB")

    objects = sorted(set(sA['results'].keys()) | set(sB['results'].keys()))
    _a = sA["statuscode"]
    _b = sB["statuscode"]
    print("statuscodes:".rjust(18), _a,
          " = " if _a == _b else " ! ", _b)
    for k in objects:
        _a = sA['results'].get(k, ' ' * 20)
        _b = sB['results'].get(k, ' ' * 20)
        print(_a, " = " if _a == _b else " ! ", _b, k)
        if _a != ' '*20:
            shutil.copy("objects/" + _a, "/tmp/artA/" + k)
        if _b != ' '*20:
            shutil.copy("objects/" + _b, "/tmp/artB/" + k)
        if k.endswith(".pdf"):
            subprocess.run(["pdfutil", "decompress", "-i",
                            "/tmp/artA/" + k, "-o", "/tmp/artA/_" + k])
            subprocess.run(["pdfutil", "decompress", "-i",
                            "/tmp/artB/" + k, "-o", "/tmp/artB/_" + k])
    print()


if __name__ == "__main__":
    artifacts()
