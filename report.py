import click
import magic

import os
import json
from datetime import datetime
import time
import tarfile
import gzip
import shutil
from pathlib import Path
import subprocess
import tempfile
import hashlib
from functools import reduce
import queue
import threading

# https://stackoverflow.com/a/44873382


def sha256sum(filename):
    h = hashlib.sha256()
    b = bytearray(128*1024)
    mv = memoryview(b)
    with open(filename, 'rb', buffering=0) as f:
        for n in iter(lambda: f.readinto(mv), 0):
            h.update(mv[:n])
    return h.hexdigest()


TAGS = {
    # TODO: this is output from xdvipdfmx
    'no-font-for-pdf': "Cannot proceed without .vf or \"physical\" font for PDF output...",
    'latex-pstricks-not-found': "! LaTeX Error: File `pstricks.sty' not found.",
    'latex-file-not-found': "LaTeX Error: File",
    'undefined-control-sequence': "! Undefined control sequence.",
    'not-latex': "LaTeX Error: Missing \\begin{document}",
    'uses-inputenc': "Package inputenc Error: inputenc is not designed for xetex or luatex.",
    'latex-error': "LaTeX Error",
    'bad-character-code': "! Bad character code",
    'bib-failed': "\\end{thebibliography}"
}

IMPLIED_TAGS = {k: set([k_ for k_, v_ in TAGS.items(
) if v_ in v and k_ != k]) for k, v in TAGS.items()}


def get_tags(p):
    if p.exists():
        with open(p) as f:
            data = f.read()
    else:
        return ["no-log-file"]
    res = []
    for k, v in TAGS.items():
        if v in data:
            res.append(k)

    redundant = reduce(lambda a, b: a | b, [
                       IMPLIED_TAGS[tag] for tag in res], set())
    return sorted(list(set(res) - redundant))


_CAPTURE_EXCLUDE = set()  # TODO: why is this global


def capture_files(d, exclude_all=False):
    global _CAPTURE_EXCLUDE
    captured = {}
    for f in d.iterdir():
        if not f.is_file():
            continue
        digest = sha256sum(f)[:16]
        if exclude_all:
            _CAPTURE_EXCLUDE.add(digest)
            continue
        elif digest in _CAPTURE_EXCLUDE:
            continue

        ext = f.suffix or ".bin"
        target = Path("objects") / (digest + ext)
        if not target.exists():
            shutil.copy(f, target)
        captured[f.name] = digest + ext
    return captured


_libmagic_threadsafe = threading.Lock()


class TestEnv(object):
    def __init__(self, sample):
        self.tmpdir = Path(tempfile.mkdtemp('ttrac'))
        with _libmagic_threadsafe:
            assert magic.detect_from_filename(
                sample).mime_type == 'application/gzip'

        submission_data_path = self.tmpdir / sample.stem

        with gzip.open(sample) as gz:
            with open(submission_data_path, "wb") as f:
                shutil.copyfileobj(gz, f)

        with _libmagic_threadsafe:
            if magic.detect_from_filename(submission_data_path).mime_type == "application/x-tar":
                with tarfile.open(submission_data_path, 'r') as tar:
                    tar.extractall(path=self.tmpdir)
                submission_data_path.unlink()

    def __enter__(self):
        return self.tmpdir

    def __exit__(self, exc, value, tb):
        shutil.rmtree(self.tmpdir)


BUNDLE_URL = "https://data1.fullyjustified.net/tlextras-2021.3r1.tar"
ARGUMENTS = [
    "-w", BUNDLE_URL,
    #"--only-cached", "--keep-logs", "--keep-intermediates",
    "-C", "--keep-logs", "--keep-intermediates",
    #"-Z", "pdf-deterministic-tags",
    # "-Z", "pdf-disable-compression", # produces >10 GB of artifacts
    #"-Z", "keep-xdv",
    # "-Z", "omit-build-date", # not implemented
]


def do_work(sample, repo):
    print(sample)
    if sample.stat().st_size < 100:
        # submission was withdrawn
        return
    if sample.stem == "1702.07035":
        return  # no tex sources
    if sample.stem == "1702.07668":
        return
    if sample.stem == "1702.06452":
        return

    env = os.environ.copy()
    env["SOURCE_DATE_EPOCH"] = "1456304492"
    with TestEnv(sample) as d:
        capture_files(d, exclude_all=True)
        print(d)
        maindoc = get_maindoc(d, sample)
        tectonic = Path(repo) / "target" / "release" / "tectonic"
        start = time.time()
        test = subprocess.run([tectonic] + ARGUMENTS +
                              [maindoc], timeout=60*2, cwd=d, env=env)
        delta = time.time() - start
        print(test)
        logfile = maindoc.with_suffix(".log")
        tags = get_tags(logfile)
        results = capture_files(d)
        report = dict(sample=sample.stem,
                      statuscode=test.returncode, seconds=delta, results=results, tags=tags)
    print(json.dumps(report))
    return report


@click.command()
@click.argument('corpus', type=click.Path(exists=True))
@click.argument('repo', type=click.Path(exists=True))
def report(corpus, repo):
    print(repo, corpus)

    name = subprocess.check_output(
        "git describe --always --dirty --tags --exclude continuous".split(), cwd=repo).decode().strip()
    branch = subprocess.check_output(
        "git rev-parse --abbrev-ref HEAD".split(), cwd=repo).decode().strip()
    commit = subprocess.check_output(
        "git rev-parse HEAD".split(), cwd=repo).decode().strip()
    timestamp = subprocess.check_output(
        "git show -s --format=%ci".split(), cwd=repo).decode().strip()

    if branch != "HEAD":
        name = branch + "-" + name

    if "dirty" in name and click.confirm("repo is dirty => use current time?"):
        timestamp = datetime.now().isoformat()

    meta = {
        "name": name,
        "branch": branch,
        "commit": commit,
        "link": None,
        "version": 0,
        "timestamp": timestamp,
        "dataset": Path(corpus).stem,
        "bundle_url": BUNDLE_URL,
        "meta": True
    }

    reportpath = Path("reports") / (name + ".jsonl")
    continueData = None
    skipSamples = set()
    if reportpath.exists():
        if click.confirm("report file already exists. abort?"):
            return
        if click.confirm("continue report (vs overwrite)?"):
            with open(reportpath) as f:
                continueData = f.read()
            for l in continueData.splitlines()[1:]:
                skipSamples.add(json.loads(l)["sample"])
    reportlog = open(reportpath, "w")

    if continueData:
        reportlog.write(continueData)
    else:
        reportlog.write(json.dumps(meta) + "\n")
    reportlog.flush()
    print(json.dumps(meta))

    subprocess.check_output("cargo build --release".split(), cwd=repo)
    tectonic = Path(repo) / "target" / "release" / "tectonic"
    # ensure that the tectonic binary is not replaced with another version
    tectonic_temp = tempfile.NamedTemporaryFile(
        suffix="tectonic", delete=False)
    shutil.copy2(tectonic, tectonic_temp.name)
    tectonic_temp.close()
    tectonic = tectonic_temp.name

    work = queue.Queue()
    outlock = threading.Lock()
    num_worker_threads = 7

    def worker():
        while True:
            item = work.get()
            if item is None:
                print("worker shutting down")
                break
            report = do_work(item, repo)
            work.task_done()
            if report:
                with outlock:
                    reportlog.write(json.dumps(report) + "\n")
                    reportlog.flush()

    threads = []
    for i in range(num_worker_threads):
        t = threading.Thread(target=worker)
        t.start()
        threads.append(t)

    for sample in Path(corpus).iterdir():
        if sample.stem in skipSamples:
            print(sample.stem, "already reported")
            continue
        work.put(sample)

    work.join()

    for i in range(num_worker_threads):
        work.put(None)
    for t in threads:
        t.join()
    reportlog.close()


if __name__ == '__main__':
    report()
