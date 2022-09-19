FROM ubuntu:22.04

ARG DEBIAN_FRONTEND="noninteractive"
ENV TZ="Etc/UTC"
RUN apt-get update && apt-get install -y htop python3 python3-pip curl git p7zip \
 openssl libssl-dev pkg-config cmake \
 libfreetype6 libfreetype6-dev libharfbuzz-dev \
 fontconfig libgraphite2-3 libgraphite2-dev \
 libfontconfig1 libfontconfig1-dev libmagic-dev
RUN pip3 install click python-magic file

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt update && apt install -y yarn

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init \
    && chmod +x /tmp/rustup-init \
    && /tmp/rustup-init -y --default-toolchain nightly --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /root
COPY report_ci.py .
COPY meta.py .
COPY github-ci ./github-ci

WORKDIR /root/github-ci
# NOTE(2022-09-19): nodegit's wheels are currently stuck on node v14 and below
# install build dependencies:
# python2 -> https://github.com/nodegit/nodegit/issues/1608
RUN apt-get install -y git build-essential clang libssl-dev libkrb5-dev libc++-dev wget python2-minimal krb5-config
RUN yarn install && yarn cache clean && yarn run build

# /repo is a bind mount and might have wonky uids that scare modern git versions
RUN git config --global --add safe.directory /repo

CMD ["yarn", "start"]
