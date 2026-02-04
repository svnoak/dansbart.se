package se.dansbart.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Security configuration for Authentik OIDC authentication.
 * Active when ENABLE_AUTH_FEATURES=true (default) and not in 'local' profile.
 */
@Configuration
@EnableWebSecurity
@Profile("!local")
@ConditionalOnProperty(name = "dansbart.auth.enabled", havingValue = "true", matchIfMissing = true)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints (no auth required)
                .requestMatchers(HttpMethod.GET, "/api/tracks/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/artists/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/albums/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/styles/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stats/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                // Auth config endpoint (public)
                .requestMatchers("/api/config/auth").permitAll()
                // Swagger/OpenAPI
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // Health check
                .requestMatchers("/actuator/health").permitAll()
                // User endpoints require authentication
                .requestMatchers("/api/playlists/**").authenticated()
                .requestMatchers("/api/users/**").authenticated()
                .requestMatchers("/api/feedback/**").authenticated()
                // Admin endpoints require specific role
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Default: require authentication
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(new JwtAuthenticationConverter())
                )
            );

        return http.build();
    }
}
