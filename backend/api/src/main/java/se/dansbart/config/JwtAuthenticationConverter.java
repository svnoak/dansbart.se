package se.dansbart.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Converts Authentik JWT tokens to Spring Security authorities.
 */
public class JwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = extractAuthorities(jwt);
        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    @SuppressWarnings("unchecked")
    private Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
        // Extract groups from Authentik JWT
        List<String> groups = jwt.getClaimAsStringList("groups");
        if (groups == null) {
            groups = List.of();
        }

        // Map Authentik groups to Spring Security roles
        return groups.stream()
            .map(group -> {
                if (group.equalsIgnoreCase("dansbart-admins")) {
                    return "ROLE_ADMIN";
                }
                return "ROLE_USER";
            })
            .distinct()
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toList());
    }
}
