FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY pom.xml ./
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -DskipTests clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /build/target/*.jar /app/xpay.jar
EXPOSE 8888
ENTRYPOINT ["java", "-jar", "/app/xpay.jar"]
