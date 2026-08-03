# Multi-stage Dockerfile for building and running the Rust `server` binary

# FROM rust:1.80-slim as builder
FROM rust:latest as builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev libpq-dev ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Cache dependencies: copy manifest and dummy source to populate Cargo registry
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && echo 'fn main() { println!("dummy"); }' > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy actual source files and rebuild the real release binary
COPY . .
RUN rm -rf target/release
RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/server /usr/local/bin/server

ENV RUST_LOG=info
EXPOSE 3000

CMD ["/usr/local/bin/server"]
