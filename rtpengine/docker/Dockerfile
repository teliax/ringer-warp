FROM debian:bullseye

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libavfilter-dev \
    libswresample-dev \
    libcurl4-openssl-dev \
    libglib2.0-dev \
    libhiredis-dev \
    libjson-glib-dev \
    libpcap-dev \
    libpcre3-dev \
    libssl-dev \
    libsystemd-dev \
    libxmlrpc-core-c3-dev \
    markdown \
    zlib1g-dev \
    libspandsp-dev \
    libwebsockets-dev \
    libopus-dev \
    libmariadb-dev \
    libiptc-dev \
    libmnl-dev \
    libevent-dev \
    libbencode-perl \
    libcrypt-openssl-rsa-perl \
    libcrypt-rijndael-perl \
    libdigest-crc-perl \
    libdigest-hmac-perl \
    libio-multiplex-perl \
    libio-socket-inet6-perl \
    libjson-perl \
    libnet-interface-perl \
    libsocket6-perl \
    && rm -rf /var/lib/apt/lists/*

# Clone and build RTPEngine
WORKDIR /usr/src
RUN git clone https://github.com/sipwise/rtpengine.git \
    && cd rtpengine \
    && git checkout mr11.5.1.8 \
    && make

# Install RTPEngine
WORKDIR /usr/src/rtpengine
RUN make install

# Create directories
RUN mkdir -p /etc/rtpengine /var/log/rtpengine /var/spool/rtpengine

# Entry point
ENTRYPOINT ["rtpengine"]
CMD ["--foreground"]