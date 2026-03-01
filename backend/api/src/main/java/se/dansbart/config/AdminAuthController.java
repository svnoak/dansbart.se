package se.dansbart.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.MediaType;

/**
 * Controller for password-based admin authentication.
 * Only active when ENABLE_AUTH_FEATURES=false.
 */
@RestController
@RequestMapping(value = "/api/admin/auth", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminAuthController {

    private final AuthProperties authProperties;

    // Simple in-memory token store (tokens are valid for the lifetime of the application)
    private static final ConcurrentHashMap<String, Long> validTokens = new ConcurrentHashMap<>();
    private static final long TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

    public AdminAuthController(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // Only allow password auth when OIDC is disabled
        if (authProperties.isEnabled()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Password authentication is disabled. Use OIDC."));
        }

        String adminPassword = authProperties.getAdminPassword();
        if (adminPassword == null || adminPassword.isBlank()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "ADMIN_PASSWORD not configured"));
        }

        if (!adminPassword.equals(request.password())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid password"));
        }

        // Generate a secure token
        String token = generateToken();
        validTokens.put(token, System.currentTimeMillis() + TOKEN_VALIDITY_MS);

        return ResponseEntity.ok(Map.of(
            "token", token,
            "expiresIn", TOKEN_VALIDITY_MS / 1000
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            validTokens.remove(token);
        }
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authProperties.isEnabled()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Password authentication is disabled"));
        }

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "No token provided"));
        }

        String token = authHeader.substring(7);
        if (!isValidToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired token"));
        }

        return ResponseEntity.ok(Map.of("valid", true));
    }

    public static boolean isValidToken(String token) {
        Long expiry = validTokens.get(token);
        if (expiry == null) {
            return false;
        }
        if (System.currentTimeMillis() > expiry) {
            validTokens.remove(token);
            return false;
        }
        return true;
    }

    private String generateToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record LoginRequest(String password) {}
}
