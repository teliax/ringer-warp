FROM kamailio/kamailio:5.7-alpine3.17

USER root

# Install required packages
RUN apk add --no-cache \
    bash \
    curl \
    postgresql-client \
    redis \
    && rm -rf /var/cache/apk/*

# Create directories
RUN mkdir -p /etc/kamailio /var/run/kamailio /var/log/kamailio

# Copy configuration files
COPY kamailio.cfg /etc/kamailio/kamailio.cfg
COPY kamctlrc /etc/kamailio/kamctlrc

# Set permissions
RUN chown -R kamailio:kamailio /etc/kamailio /var/run/kamailio /var/log/kamailio

# Expose ports
EXPOSE 5060/udp 5060/tcp 5061/tcp 8080/tcp 8443/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD kamctl ping || exit 1

USER kamailio

# Start Kamailio
CMD ["kamailio", "-DD", "-E", "-M", "8", "-m", "64"]