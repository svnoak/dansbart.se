# Build stage
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# Copy Maven wrapper and pom.xml
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Download dependencies (cached layer). The Maven repository is also a cache
# mount, so the package step below reuses what is already downloaded instead of
# asking Maven Central again on every build.
RUN --mount=type=cache,id=maven,target=/root/.m2 \
    chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copy source code
COPY src src

# Build the application (skip Flyway + jOOQ codegen; no DB at build time; use committed jOOQ sources)
RUN --mount=type=cache,id=maven,target=/root/.m2 \
    ./mvnw package -DskipTests -B -DskipDbBuild=true

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy the built JAR
COPY --from=build /app/target/*.jar app.jar

# Run the application
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
