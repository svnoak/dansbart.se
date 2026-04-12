package se.dansbart.e2e.fixture;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

/**
 * Helper for injecting authentication in MockMvc tests.
 *
 * Uses a UsernamePasswordAuthenticationToken with a String principal,
 * matching exactly what DiscourseConnectController sets in production.
 * @AuthenticationPrincipal String userId resolves correctly.
 */
@Component
public class JwtTestHelper {

    public RequestPostProcessor userToken(String userId) {
        return authentication(new UsernamePasswordAuthenticationToken(
            userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))
        ));
    }

    public RequestPostProcessor adminToken(String userId) {
        return authentication(new UsernamePasswordAuthenticationToken(
            userId, null, List.of(
                new SimpleGrantedAuthority("ROLE_ADMIN"),
                new SimpleGrantedAuthority("ROLE_USER")
            )
        ));
    }
}
