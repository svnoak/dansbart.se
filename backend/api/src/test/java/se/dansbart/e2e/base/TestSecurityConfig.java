package se.dansbart.e2e.base;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Test security configuration that provides a mock JWT decoder.
 * This allows tests to use simple test tokens without a real OAuth2 issuer.
 */
@TestConfiguration
public class TestSecurityConfig {

    @Bean
    @Primary
    public JwtDecoder testJwtDecoder() {
        return token -> {
            // Parse test tokens in format: "test-user-{userId}" or "test-admin-{userId}"
            if (token == null || token.isBlank()) {
                throw new JwtException("Token cannot be empty");
            }

            String subject = extractSubject(token);
            List<String> groups = extractGroups(token);

            return Jwt.withTokenValue(token)
                .header("alg", "none")
                .header("typ", "JWT")
                .subject(subject)
                .claim("groups", groups)
                .claim("preferred_username", "testuser_" + subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        };
    }

    private String extractSubject(String token) {
        // Token format: "test-user-{userId}" or "test-admin-{userId}"
        if (token.startsWith("test-user-")) {
            return token.substring("test-user-".length());
        } else if (token.startsWith("test-admin-")) {
            return token.substring("test-admin-".length());
        }
        // If not a test token format, use the token itself as subject
        return token;
    }

    private List<String> extractGroups(String token) {
        if (token.startsWith("test-admin-")) {
            return List.of("dansbart-admins", "users");
        }
        return List.of("users");
    }
}
