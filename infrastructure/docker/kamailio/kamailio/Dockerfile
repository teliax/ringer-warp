# Production Kamailio Docker Image for WARP Platform
# Based on Debian for stability and package availability
FROM debian:bullseye-slim

# Set version explicitly (Kamailio 6.0.x from kamailio60 repo)
ENV KAMAILIO_MAJOR_VERSION=6.0

# Install dependencies and Kamailio
# Note: Installing without exact version to allow apt to choose latest available for architecture
RUN apt-get update && apt-get install -y \
    gnupg2 \
    wget \
    ca-certificates \
    && echo "deb http://deb.kamailio.org/kamailio60 bullseye main" > /etc/apt/sources.list.d/kamailio.list \
    && wget -O- http://deb.kamailio.org/kamailiodebkey.gpg | apt-key add - \
    && apt-get update && apt-get install -y \
    kamailio \
    kamailio-redis-modules \
    kamailio-postgres-modules \
    kamailio-websocket-modules \
    kamailio-tls-modules \
    kamailio-json-modules \
    kamailio-utils-modules \
    kamailio-extra-modules \
    kamailio-lua-modules \
    kamailio-presence-modules \
    kamailio-xml-modules \
    kamailio-snmpstats-modules \
    # Runtime dependencies
    postgresql-client \
    net-tools \
    procps \
    curl \
    jq \
    lua5.2 \
    liblua5.2-dev \
    luarocks \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install LuaJIT for high-performance routing
RUN apt-get update && apt-get install -y \
    libluajit-5.1-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Lua dependencies for API calls
RUN luarocks install lua-cjson \
    && luarocks install luasocket \
    && luarocks install lua-resty-http

# Create required directories
RUN mkdir -p /etc/kamailio \
    /var/log/kamailio \
    /var/run/kamailio \
    /usr/local/etc/kamailio

# Create kamailio user (if not exists) and set permissions
RUN id kamailio || useradd -r -s /bin/false -d /var/run/kamailio kamailio \
    && chown -R kamailio:kamailio /var/log/kamailio /var/run/kamailio

# Copy configuration files
COPY kamailio.cfg /etc/kamailio/kamailio.cfg
COPY kamctlrc /etc/kamailio/kamctlrc
COPY dispatcher.list /etc/kamailio/dispatcher.list
COPY tls.cfg /etc/kamailio/tls.cfg
COPY scripts/ /usr/local/etc/kamailio/scripts/

# Make config files writable by kamailio user
RUN chown -R kamailio:kamailio /etc/kamailio /usr/local/etc/kamailio

# Copy health check script
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables for configuration
# Note: PUBLIC_IP and PRIVATE_IP will be auto-detected if not provided
ENV DB_HOST=34.42.208.57 \
    DB_PORT=5432 \
    DB_NAME=warp \
    DB_USER=warp \
    DB_PASS="" \
    SIP_DOMAIN=ringer.tel \
    PUBLIC_IP="" \
    PRIVATE_IP="" \
    WEBSOCKET_PORT=8080 \
    TLS_PORT=5061 \
    RTPENGINE_LIST="udp:rtpengine:2223" \
    LOG_LEVEL=2 \
    ENABLE_DEBUG=0

# Expose ports
# 5060 - SIP UDP/TCP
# 5061 - SIP TLS
# 8080 - WebSocket
# 8443 - Secure WebSocket
# 9090 - Prometheus metrics
EXPOSE 5060/udp 5060/tcp 5061/tcp 8080/tcp 8443/tcp 9090/tcp

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD ["/usr/local/bin/healthcheck.sh"]

# Run as root for now to debug permissions
# USER kamailio

# Entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command
CMD ["kamailio", "-DD", "-E", "-e", "-m", "256", "-M", "32"]