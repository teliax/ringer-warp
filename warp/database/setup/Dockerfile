FROM postgres:15-alpine

# Install additional tools
RUN apk add --no-cache bash

# Copy schema files
COPY schema /schema

# Copy initialization script
COPY setup/init-database.sh /init-database.sh
RUN chmod +x /init-database.sh

# Set working directory
WORKDIR /

# Default command
CMD ["/init-database.sh"]