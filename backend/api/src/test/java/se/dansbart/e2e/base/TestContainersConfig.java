package se.dansbart.e2e.base;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Singleton TestContainers configuration for E2E tests.
 * Uses container reuse for faster test execution across test classes.
 */
public class TestContainersConfig {

    // Singleton PostgreSQL container with pgvector extension
    public static final PostgreSQLContainer<?> POSTGRES;

    // Singleton Redis container for Celery task dispatch
    public static final GenericContainer<?> REDIS;

    static {
        // Use pgvector image for vector similarity support
        // Must declare as compatible substitute for postgres
        DockerImageName pgvectorImage = DockerImageName.parse("pgvector/pgvector:pg16")
            .asCompatibleSubstituteFor("postgres");

        POSTGRES = new PostgreSQLContainer<>(pgvectorImage)
            .withDatabaseName("dansbart_test")
            .withUsername("test")
            .withPassword("test")
            .withReuse(true);

        REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379)
            .withReuse(true);

        POSTGRES.start();
        REDIS.start();
    }

    public static String getPostgresJdbcUrl() {
        return POSTGRES.getJdbcUrl();
    }

    public static String getPostgresUsername() {
        return POSTGRES.getUsername();
    }

    public static String getPostgresPassword() {
        return POSTGRES.getPassword();
    }

    public static String getRedisHost() {
        return REDIS.getHost();
    }

    public static Integer getRedisPort() {
        return REDIS.getMappedPort(6379);
    }

    public static String getRedisUrl() {
        return String.format("redis://%s:%d/0", getRedisHost(), getRedisPort());
    }
}
