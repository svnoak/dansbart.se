package se.dansbart.repository;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.e2e.base.TestContainersConfig;
import se.dansbart.e2e.base.TestSecurityConfig;
import se.dansbart.e2e.fixture.TestDataFactory;

/**
 * Base class for repository tests. Uses Testcontainers (PostgreSQL, Redis),
 * full Spring context, and transaction rollback for isolation.
 * jOOQ inserts are visible in the same transaction; no flush needed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, TestDataFactory.class})
@Transactional
public abstract class AbstractRepositoryTest {

    /** No-op for compatibility; jOOQ does not use a persistence context. */
    protected void flush() {
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", TestContainersConfig::getPostgresJdbcUrl);
        registry.add("spring.datasource.username", TestContainersConfig::getPostgresUsername);
        registry.add("spring.datasource.password", TestContainersConfig::getPostgresPassword);
        registry.add("spring.data.redis.host", TestContainersConfig::getRedisHost);
        registry.add("spring.data.redis.port", TestContainersConfig::getRedisPort);
        registry.add("dansbart.celery.broker-url", TestContainersConfig::getRedisUrl);
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri",
            () -> "http://localhost:9999/test-issuer");
        registry.add("dansbart.auth.enabled", () -> "true");
    }
}
