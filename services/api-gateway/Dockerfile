# Build stage
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Copy source code first (need for go mod tidy)
COPY . .

# Download dependencies and generate go.sum
RUN go mod tidy && go mod download

# Install swag for Swagger generation
RUN go install github.com/swaggo/swag/cmd/swag@latest

# Generate Swagger docs
RUN /go/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal || mkdir -p docs

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api-server ./cmd/server

# Final stage
FROM alpine:3.18

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/api-server .

# Copy docs directory (for Swagger)
COPY --from=builder /app/docs ./docs

# Create non-root user
RUN addgroup -g 1000 warp && \
    adduser -D -u 1000 -G warp warp && \
    chown -R warp:warp /app

USER warp

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./api-server"]
