FROM rust:1.88-bookworm AS build
WORKDIR /src
COPY . .
RUN cargo build --workspace --release

FROM debian:bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/qianfu-api /usr/local/bin/qianfu-api
USER 65532:65532
EXPOSE 3100
ENTRYPOINT ["/usr/local/bin/qianfu-api"]

FROM debian:bookworm-slim AS worker
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/qianfu-worker /usr/local/bin/qianfu-worker
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/qianfu-worker"]
