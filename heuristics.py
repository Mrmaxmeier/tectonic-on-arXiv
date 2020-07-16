EXCLUDED_SAMPLES = [
    "1702.07035",  # no tex sources
    "1702.07668",
    # "1702.06452", # skeleton.tex is in skip list
]

SKIP_FILES = [
    "supplementary.tex",  # datasets/1702/1702.08884.gz
    "atlas_authlist.tex",  # datasets/1702/1702.08839.gz
    "Preamble.tex",
    "SuppMat.tex",
    "supp.tex",
    "skeleton.tex",
    "biography.tex",
    "author_information.tex",
    "framed.tex",
    "writeup.tex",
]

ENTRY_FILES = [
    "main.tex",  # datasets/1702/1702.08857.gz
    "0_main.tex",  # datasets/1702/1702.08571.gz
    "QPC-Sup-sub.tex",  # 1702.08773
    'paper_ACC17_preprint.tex',
    'KirshTLS.tex',
    'Main_arXiv.tex',
    'paper.tex', 'thesis.tex',
    'arxiv.tex',
    'ieee4double.tex'
    'tightness-dist.tex',
    'lls-connected.tex',
    'flatsArXiv2.tex',
    'Proceedings-420-STAR-on-Cori.tex',
    'Runge_causal_discovery_2018_arxiv.tex',
    'TSE_Joint_PEV_charging_network_and_PV_generation_planning_2.1.tex',
    'ICC2017_Secure_Clustered_Dsitributed_Storage_Against_Eavesdropper_Rev_2017.2.22.tex',
    'w51_review.tex',
    'LumpyPlanet_04_2017.tex',
    'EBEXPaper3.tex',
    'SM0912.tex',
    'setsph37.tex',
    'Wi_Kn_2017_Arxiv.tex',
    'Hoffmann_Antiskyrmion.tex',
    'ijcai17.tex',
    'full-eight-vertex.tex',
    'BigVARV3.tex',
    'BohrSomRevistdAll.tex',
    'WaveParticleExperiment.tex',
]


def get_maindoc(p, sample):
    viable = []
    for x in filter(lambda x: x.suffix == '.tex', p.iterdir()):
        if sample.stem == "1702.06452" and x.name == "skeleton.tex":
            return x
        if x.name in SKIP_FILES:
            continue
        if x.name in ENTRY_FILES:
            return x
        with open(x, "rb") as f:
            data = f.read()
            if b"\\documentclass" in data or b"\\bye" in data:
                viable.append(x)
    if not viable and len(list(p.iterdir())) == 1:
        # probably not a tar archive => it'll be the source file
        return next(p.iterdir())
    if not viable:
        return None
    if len(viable) >= 2:
        return None
    assert viable, "missing entry point"
    assert len(viable) < 2, "multiple entry points?"
    return viable[0]
