package se.dansbart.domain.providerconnection;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Runs the OAuth authorization code flow for every {@link OAuthConnector}.
 *
 * {@link #start} stores a random state, the person and, for a PKCE connector, a code verifier in
 * the session under keys of the provider. {@link #callback} checks them, exchanges the code and
 * stores the refresh token.
 */
@Slf4j
@Service
public class OAuthConnectionService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final List<OAuthConnector> connectors;
    private final ConnectionTokenStore store;

    public OAuthConnectionService(List<OAuthConnector> connectors, ConnectionTokenStore store) {
        this.connectors = connectors;
        this.store = store;
    }

    public URI start(String slug, UUID userId, HttpSession session) {
        OAuthConnector connector = connectorFor(slug);
        if (!connector.isConfigured()) {
            throw new ProviderNotConfiguredException(connector.provider());
        }
        SessionKeys keys = new SessionKeys(connector.provider());
        String state = randomToken();
        session.setAttribute(keys.state(), state);
        session.setAttribute(keys.user(), userId);
        String challenge = null;
        if (connector.usesPkce()) {
            String verifier = randomToken();
            session.setAttribute(keys.verifier(), verifier);
            challenge = challengeOf(verifier);
        }
        return connector.authorizationUri(state, challenge);
    }

    public CallbackOutcome callback(
            String slug, UUID userId, HttpSession session, String state, String code, String error) {
        OAuthConnector connector = connectorFor(slug);
        String provider = connector.provider();
        SessionKeys keys = new SessionKeys(provider);
        Object storedState = session.getAttribute(keys.state());
        Object storedUserId = session.getAttribute(keys.user());
        Object verifier = session.getAttribute(keys.verifier());
        session.removeAttribute(keys.state());
        session.removeAttribute(keys.user());
        session.removeAttribute(keys.verifier());

        if (storedState == null || state == null || !sameText((String) storedState, state)
                || storedUserId == null || !storedUserId.equals(userId)) {
            return CallbackOutcome.REJECTED;
        }
        if (error != null && !error.isBlank()) {
            return CallbackOutcome.DECLINED;
        }
        if (code == null || code.isBlank()) {
            return CallbackOutcome.FAILED;
        }

        String refreshToken;
        try {
            refreshToken = connector.exchangeCode(code, (String) verifier).refreshToken();
        } catch (RuntimeException e) {
            log.warn("{} code exchange failed for user {}: {}", provider, userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            log.warn("{} issued no refresh token for user {}", provider, userId);
            return CallbackOutcome.FAILED;
        }

        try {
            store.store(userId, provider, refreshToken);
        } catch (RuntimeException e) {
            log.warn("Storing the {} connection failed for user {}: {}",
                provider, userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        return CallbackOutcome.CONNECTED;
    }

    private OAuthConnector connectorFor(String slug) {
        return connectors.stream()
            .filter(candidate -> candidate.slug().equals(slug))
            .findFirst()
            .orElseThrow(() -> new UnknownProviderException(slug));
    }

    private record SessionKeys(String provider) {
        String state() {
            return "connect." + provider + ".state";
        }

        String user() {
            return "connect." + provider + ".user";
        }

        String verifier() {
            return "connect." + provider + ".verifier";
        }
    }

    private static boolean sameText(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String challengeOf(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
