package se.dansbart.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Security configuration for password-based admin authentication.
 * Active when ENABLE_AUTH_FEATURES=false (and not in 'local' profile which bypasses all auth).
 */
@Configuration
@EnableWebSecurity
@Profile("!local")
@ConditionalOnProperty(name = "dansbart.auth.enabled", havingValue = "false")
public class PasswordAuthSecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(new AdminTokenAuthFilter(), UsernamePasswordAuthenticationFilter.class)
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
                // Admin auth endpoints (public - needed for login)
                .requestMatchers("/api/admin/auth/**").permitAll()
                // Swagger/OpenAPI
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                // Health check
                .requestMatchers("/actuator/health").permitAll()
                // Admin endpoints require token auth
                .requestMatchers("/api/admin/**").authenticated()
                // User endpoints - permit all when auth disabled (no user context)
                .requestMatchers("/api/playlists/**").permitAll()
                .requestMatchers("/api/users/**").permitAll()
                .requestMatchers("/api/feedback/**").permitAll()
                // Default: permit
                .anyRequest().permitAll()
            );

        return http.build();
    }

    /**
     * Filter to validate admin tokens from Authorization header.
     */
    private static class AdminTokenAuthFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                        FilterChain filterChain) throws ServletException, IOException {
            String authHeader = request.getHeader("Authorization");

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);

                if (AdminAuthController.isValidToken(token)) {
                    // Create authentication with ADMIN role
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));
                    var authentication = new UsernamePasswordAuthenticationToken(
                        "admin", null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }

            filterChain.doFilter(request, response);
        }
    }
}
