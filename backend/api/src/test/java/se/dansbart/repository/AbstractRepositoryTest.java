package se.dansbart.repository;

import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
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
 * Call {@link #flush()} after creating data with TestDataFactory when testing jOOQ
 * so that inserts are visible to the same transaction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, TestDataFactory.class})
@Transactional
public abstract class AbstractRepositoryTest {

    @Autowired(required = false)
    private EntityManager entityManager;

    /** Flush JPA persistence context so jOOQ queries see inserted data in the same transaction. */
    protected void flush() {
        if (entityManager != null) {
            entityManager.flush();
        }
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
