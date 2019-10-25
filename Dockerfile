FROM ubuntu:19.10

MAINTAINER Mrmaxmeier

RUN apt update
RUN apt install -y python3 python3-pip nodejs curl git p7zip \
 openssl libssl-dev pkg-config cmake \
 libfreetype6 libfreetype6-dev libharfbuzz-dev \
 fontconfig libgraphite2-3 libgraphite2-dev \
 libfontconfig1 libfontconfig1-dev libmagic-dev
RUN pip3 install click python-magic file

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt update && apt install -y yarn

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init \
    && chmod +x /tmp/rustup-init \
    && /tmp/rustup-init -y --default-toolchain nightly --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /root
COPY report.py .
COPY meta.py .
COPY github-ci ./github-ci

WORKDIR /root/github-ci
RUN yarn install && yarn run build

ENTRYPOINT yarn start
