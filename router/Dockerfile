# ═══════════════════════════════════════════════════════════════
# STAGE 1: Builder
# ═══════════════════════════════════════════════════════════════
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev

WORKDIR /app

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code
COPY src ./src

# Build for release
RUN touch src/main.rs && \
    cargo build --release && \
    strip target/release/router

# ═══════════════════════════════════════════════════════════════
# STAGE 2: Runner
# ═══════════════════════════════════════════════════════════════
FROM alpine:latest AS runner

# Install runtime dependencies
RUN apk add --no-cache ca-certificates libgcc

# Add non-root user
RUN addgroup -g 1001 -S rust && \
    adduser -u 1001 -S rust -G rust

WORKDIR /app

# Copy binary from builder
COPY --from=builder --chown=rust:rust /app/target/release/router /usr/local/bin/router

# Switch to non-root user
USER rust

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/router", "--health-check"]

# Start application
CMD ["/usr/local/bin/router"]
