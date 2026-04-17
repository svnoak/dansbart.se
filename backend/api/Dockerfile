# Build stage
FROM eclipse-temurin:25.0.2_10-jdk-alpine AS build
WORKDIR /app

# Copy Maven wrapper and pom.xml
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Download dependencies (cached layer)
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copy source code
COPY src src

# Build the application (skip Flyway + jOOQ codegen; no DB at build time; use committed jOOQ sources)
RUN ./mvnw package -DskipTests -B -DskipDbBuild=true

# Runtime stage
FROM eclipse-temurin:25.0.2_10-jre-alpine
WORKDIR /app

# Copy the built JAR
COPY --from=build /app/target/*.jar app.jar

# Run the application
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
