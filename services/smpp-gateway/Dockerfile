# Multi-stage build for WARP SMPP Gateway

# Stage 1: Build
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git

# Copy source code first (need it for go mod tidy)
COPY . .

# Download dependencies and create go.sum
RUN go mod tidy && go mod download

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build \
    -a -installsuffix cgo \
    -ldflags="-w -s" \
    -o smpp-gateway \
    ./cmd/smpp-gateway

# Stage 2: Runtime
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/smpp-gateway .

# Create non-root user
RUN addgroup -g 1000 smpp && \
    adduser -D -u 1000 -G smpp smpp && \
    chown -R smpp:smpp /app

USER smpp

# Expose ports
EXPOSE 2775 2776 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/smpp-gateway"]
