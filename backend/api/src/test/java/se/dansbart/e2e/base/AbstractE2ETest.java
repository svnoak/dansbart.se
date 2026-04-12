package se.dansbart.e2e.base;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.e2e.fixture.JwtTestHelper;
import se.dansbart.e2e.fixture.TestDataFactory;

/**
 * Abstract base class for E2E tests.
 *
 * Provides:
 * - TestContainers for PostgreSQL (pgvector) and Redis
 * - MockMvc for HTTP testing
 * - Test data factory for creating test entities
 * - Auth injection via JwtTestHelper (MockMvc post-processor, no real SSO involved)
 * - Transaction rollback for test isolation
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({TestDataFactory.class, JwtTestHelper.class, TestSecurityConfig.class})
@Transactional
public abstract class AbstractE2ETest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected TestDataFactory testData;

    @Autowired
    protected JwtTestHelper jwt;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        // PostgreSQL
        registry.add("spring.datasource.url", TestContainersConfig::getPostgresJdbcUrl);
        registry.add("spring.datasource.username", TestContainersConfig::getPostgresUsername);
        registry.add("spring.datasource.password", TestContainersConfig::getPostgresPassword);

        // Redis
        registry.add("spring.data.redis.host", TestContainersConfig::getRedisHost);
        registry.add("spring.data.redis.port", TestContainersConfig::getRedisPort);
        registry.add("dansbart.celery.broker-url", TestContainersConfig::getRedisUrl);

        // Enable auth for tests
        registry.add("dansbart.auth.enabled", () -> "true");
    }

    /**
     * Serialize an object to JSON string.
     */
    protected String toJson(Object obj) throws Exception {
        return objectMapper.writeValueAsString(obj);
    }

    /**
     * Deserialize a JSON string to an object.
     */
    protected <T> T fromJson(String json, Class<T> clazz) throws Exception {
        return objectMapper.readValue(json, clazz);
    }
}
