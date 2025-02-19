from pprint import pprint
import json
import sys


def parse(p):
    with open(p) as f:
        for l in f.readlines():
            yield json.loads(l.strip())


def compare(a, b):
    print(a, b)
    iA = parse(a)
    iB = parse(b)
    _metaA = next(iA)
    _metaB = next(iB)
    entriesA = list(iA)
    entriesB = list(iB)

    samples = set([x["sample"] for x in entriesA + entriesB])

    def find(l, i):
        for x in l:
            if x["sample"] == i:
                return x

    identical = set()
    identicalSucc = set()
    different = set()
    differentStatuscode = set()
    for sample in sorted(samples):
        sA = find(entriesA, sample)
        sB = find(entriesB, sample)
        if not sA or not sB:
            continue
        if sA["statuscode"] != sB["statuscode"]:
            different.add(sample)
            differentStatuscode.add(sample)
        objects = sorted(set(sA['results'].keys()) | set(sB['results'].keys()))
        for k in objects:
            if sA['results'].get(k, None) != sB['results'].get(k, None):
                different.add(sample)
        if sample in different:
            print("sample differs:", sample)
            _a = sA["statuscode"]
            _b = sB["statuscode"]
            print("statuscodes:".rjust(18), _a,
                  " = " if _a == _b else " ! ", _b)
            for k in objects:
                _a = sA['results'].get(k, ' ' * 20)
                _b = sB['results'].get(k, ' ' * 20)
                print(_a, " = " if _a == _b else " ! ", _b, k)
            print()
        if sample not in different:
            identical.add(sample)
            if sA["statuscode"] == 0:
                identicalSucc.add(sample)

    print("summary:")
    print("  identical samples:", len(identical))
    print("  \>     successful:", len(identicalSucc))
    print("  different samples:", len(different))
    if differentStatuscode:
        print("  \>retcode changed:", len(differentStatuscode))
    print("    missing samples:", len(samples - (identical | different)))


if __name__ == "__main__":
    compare(sys.argv[1], sys.argv[2])
