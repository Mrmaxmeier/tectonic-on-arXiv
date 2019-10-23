FROM ubuntu:19.04

MAINTAINER Mrmaxmeier


RUN apt update
RUN apt install -y python3 python3-pip yarn node
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
RUN rustup toolchain install nightly && rustup default nightly
RUN pip3 install click magic


RUN useradd -d /home/ci/ -m -p ci -s /bin/bash ci
RUN echo "ci:ci" | chpasswd
WORKDIR /home/ci
USER ci

COPY ../report.py .
COPY ../summary.py .
COPY ../github-ci .


WORKDIR /home/ci/github-ci
RUN yarn run build
ENTRYPOINT yarn start
