package se.dansbart.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/**
 * BFF security configuration.
 *
 * Authentication is handled via DiscourseConnect (Discourse's built-in SSO protocol).
 * Spring stores the session in Redis and issues an httpOnly SESSION cookie to the browser.
 * The browser never holds a token.
 *
 * CSRF is protected via the double-submit cookie pattern:
 *   - Spring sets a readable XSRF-TOKEN cookie
 *   - The frontend reads it and sends X-XSRF-TOKEN on mutations
 */
@Configuration
@EnableWebSecurity
@Profile("!local & !test")
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName(null);

        http
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(requestHandler))
            .authorizeHttpRequests(auth -> auth
                // SSO endpoints — must be accessible before authentication
                .requestMatchers("/sso/**").permitAll()
                // Public endpoints
                .requestMatchers(HttpMethod.GET, "/api/tracks/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/artists/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/albums/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/styles/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stats/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/discovery/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                .requestMatchers("/api/config/auth").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/playlists/share/**").permitAll()
                // Analytics — called by all visitors including anonymous
                .requestMatchers(HttpMethod.POST, "/api/analytics/**").permitAll()
                // Admin endpoints
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Authenticated user endpoints
                .requestMatchers("/api/playlists/**").authenticated()
                .requestMatchers("/api/users/**").authenticated()
                .requestMatchers("/api/feedback/**").authenticated()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED)))
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/")
                .deleteCookies("SESSION")
                .invalidateHttpSession(true));

        return http.build();
    }
}
