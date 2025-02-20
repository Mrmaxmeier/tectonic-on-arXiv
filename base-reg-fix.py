from pprint import pprint
import json
import sys


def parse(p):
    with open(p) as f:
        for l in f.readlines():
            yield json.loads(l.strip())


def compare(base, reg, fix):
    iBase = parse(base)
    iReg = parse(reg)
    iFix = parse(fix)
    # skip meta
    next(iBase)
    next(iReg)
    next(iFix)
    entriesBase = list(iBase)
    entriesReg = list(iReg)
    entriesFix = list(iFix)

    samples = set([x["sample"] for x in entriesBase])

    def find(l, i):
        for x in l:
            if x["sample"] == i:
                return x

    deltaReg = set()
    deltaFix = set()
    deltaRegFix = set()
    for sample in sorted(samples):
        if not find(entriesReg, sample):
            continue
        if not find(entriesFix, sample):
            continue
        sBase = find(entriesBase, sample)
        sReg = find(entriesReg, sample)
        sFix = find(entriesFix, sample)

        def check(a, b):
            if a["statuscode"] != b["statuscode"]:
                return True
            objects = sorted(set(a['results'].keys()) |
                             set(b['results'].keys()))
            for k in objects:
                if a['results'].get(k, None) != b['results'].get(k, None):
                    return True
        if check(sBase, sReg):
            deltaReg.add(sample)

        if check(sBase, sFix):
            deltaFix.add(sample)

        if check(sReg, sFix):
            deltaRegFix.add(sample)

    print("total regressed (reg):", len(deltaReg))
    print("total regressed (fix):", len(deltaFix))
    print("    fixed regressions:", len(deltaReg - deltaFix))
    print("      new regressions:", len(deltaFix - deltaReg))
    print("changed but not fixed:", len(deltaFix & deltaReg & deltaRegFix))


if __name__ == "__main__":
    compare(sys.argv[1], sys.argv[2], sys.argv[3])
