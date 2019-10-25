import click
import magic

import threading
import tempfile
import os
import json
import tarfile
import gzip
import shutil
from pathlib import Path

from heuristics import get_maindoc, EXCLUDED_SAMPLES

_libmagic_threadsafe = threading.Lock()

class TestEnv(object):
	def __init__(self, sample):
		self.tmpdir = Path(tempfile.mkdtemp('ttrac'))
		with _libmagic_threadsafe:
			assert magic.detect_from_filename(sample).mime_type == 'application/gzip'

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

def prepare(sample):
	if sample.stat().st_size < 100:
		# submission was withdrawn
		return
	if sample in EXCLUDED_SAMPLES:
		return

	with TestEnv(sample) as d:
			maindoc = get_maindoc(d, sample)
			return maindoc.name

@click.command()
@click.argument('corpus', type=click.Path(exists=True))
def prepare_dataset(corpus):
	output = {}
	output_path = corpus + ".json"
	assert corpus[-1] != "/"

	for sample in Path(corpus).iterdir():
		res = prepare(sample)
		if res:
			print(sample.stem, res)
			output[sample.stem] = res
	
	with open(output_path, "w") as f:
		json.dump(output, f)



if __name__ == '__main__':
	prepare_dataset()
