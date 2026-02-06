package se.dansbart.config;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Controller to expose authentication configuration to the frontend.
 * Single source of truth: one flag (authEnabled) drives login, playlists, and user features.
 * - authEnabled=false: no user login; admin uses password only; frontend hides login/playlists.
 * - authEnabled=true: OIDC (Authentik) login; playlists and profile enabled.
 */
@RestController
@RequestMapping("/api/config")
public class AuthConfigController {

    private final AuthProperties authProperties;

    public AuthConfigController(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    @GetMapping("/auth")
    public Map<String, Object> getAuthConfig() {
        return Map.of(
            "authEnabled", authProperties.isEnabled(),
            "authMethod", authProperties.isEnabled() ? "oidc" : "password"
        );
    }
}
