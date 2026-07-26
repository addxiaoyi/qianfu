FROM eclipse-temurin:8-jdk-jammy AS prepare

RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY artifacts/paypro.jar /work/app.jar

# The upstream archive contains sample payment QR files. They must never enter
# the runtime image; confirmed assets are mounted separately at runtime.
RUN if unzip -Z1 /work/app.jar | grep -q '^BOOT-INF/classes/static/assets/qr/'; then \
      zip -d /work/app.jar 'BOOT-INF/classes/static/assets/qr/*'; \
    fi \
    && mkdir -p /work/static /work/unpacked \
    && cd /work/unpacked \
    && unzip -q /work/app.jar 'BOOT-INF/classes/static/*' \
    && cp -R BOOT-INF/classes/static/. /work/static/ \
    && mkdir -p /work/static/assets/qr

FROM eclipse-temurin:8-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 paypro \
    && useradd --uid 10001 --gid 10001 --home-dir /opt/paypro --shell /usr/sbin/nologin paypro \
    && mkdir -p /opt/paypro/static/assets/qr \
    && chown -R 10001:10001 /opt/paypro

COPY --from=prepare --chown=10001:10001 /work/app.jar /opt/paypro/app.jar
COPY --from=prepare --chown=10001:10001 /work/static/ /opt/paypro/static/

USER 10001:10001
WORKDIR /opt/paypro

ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8 -Djava.security.egd=file:/dev/urandom"

EXPOSE 8889
ENTRYPOINT ["java", "-jar", "/opt/paypro/app.jar"]
