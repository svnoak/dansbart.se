package se.dansbart.domain.providerconnection;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

/** Connects a person's HiDrive. HiDrive has no PKCE, so the state in the session is the only binding. */
@Slf4j
@Service
public class HiDriveConnectionService {

    private static final String STATE_KEY = "hidriveConnectState";
    private static final String USER_KEY = "hidriveConnectUser";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HiDriveConnector connector;
    private final ConnectionTokenStore store;

    public HiDriveConnectionService(HiDriveConnector connector, ConnectionTokenStore store) {
        this.connector = connector;
        this.store = store;
    }

    public URI start(UUID userId, HttpSession session) {
        if (!connector.isConfigured()) {
            throw new ProviderNotConfiguredException(connector.provider());
        }
        String state = randomToken();
        session.setAttribute(STATE_KEY, state);
        session.setAttribute(USER_KEY, userId);
        return connector.authorizationUri(state);
    }

    public CallbackOutcome callback(
            UUID userId, HttpSession session, String state, String code, String error) {
        Object storedState = session.getAttribute(STATE_KEY);
        Object storedUserId = session.getAttribute(USER_KEY);
        session.removeAttribute(STATE_KEY);
        session.removeAttribute(USER_KEY);

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
            refreshToken = connector.exchangeCode(code).refreshToken();
        } catch (RuntimeException e) {
            log.warn("HiDrive code exchange failed for user {}: {}", userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            log.warn("HiDrive issued no refresh token for user {}", userId);
            return CallbackOutcome.FAILED;
        }

        try {
            store.store(userId, ProviderConnection.PROVIDER_HIDRIVE, refreshToken);
        } catch (RuntimeException e) {
            log.warn("Storing the HiDrive connection failed for user {}: {}", userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        return CallbackOutcome.CONNECTED;
    }

    private static boolean sameText(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
