package se.dansbart.e2e.fixture;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

/**
 * Helper class for creating JWT authentication in tests.
 *
 * Uses Spring Security Test's jwt() post-processor with explicit authorities.
 * Note: The jwt() mock does NOT invoke JwtAuthenticationConverter, so authorities
 * must be set explicitly via .authorities() rather than relying on claim conversion.
 */
@Component
public class JwtTestHelper {

    /**
     * Creates a JWT request post-processor for a regular user.
     *
     * @param userId The user ID (will be set as the JWT subject)
     * @return RequestPostProcessor for MockMvc
     */
    public RequestPostProcessor userToken(String userId) {
        return jwt()
            .jwt(builder -> builder
                .subject(userId)
                .claim("groups", List.of("users"))
                .claim("preferred_username", "user_" + userId)
            )
            .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }

    /**
     * Creates a JWT request post-processor for an admin user.
     *
     * @param userId The user ID (will be set as the JWT subject)
     * @return RequestPostProcessor for MockMvc
     */
    public RequestPostProcessor adminToken(String userId) {
        return jwt()
            .jwt(builder -> builder
                .subject(userId)
                .claim("groups", List.of("dansbart-admins", "users"))
                .claim("preferred_username", "admin_" + userId)
            )
            .authorities(
                new SimpleGrantedAuthority("ROLE_ADMIN"),
                new SimpleGrantedAuthority("ROLE_USER")
            );
    }

    /**
     * Returns a bearer token string for use in Authorization header.
     * Useful for testing scenarios where header-based auth is needed.
     *
     * @param userId The user ID
     * @param isAdmin Whether the user is an admin
     * @return Bearer token string
     */
    public String bearerToken(String userId, boolean isAdmin) {
        String prefix = isAdmin ? "test-admin-" : "test-user-";
        return "Bearer " + prefix + userId;
    }
}
