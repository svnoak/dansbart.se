package se.dansbart.domain.providerconnection;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.jooq.exception.IntegrityConstraintViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class GoogleConnectionService {

    private static final String STATE_KEY = "googleConnectState";
    private static final String VERIFIER_KEY = "googleConnectVerifier";
    private static final String USER_KEY = "googleConnectUser";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GoogleDriveConnector connector;
    private final ProviderConnectionJooqRepository repository;
    private final TokenCipher cipher;
    private final Clock clock;

    public GoogleConnectionService(
            GoogleDriveConnector connector,
            ProviderConnectionJooqRepository repository,
            TokenCipher cipher,
            Clock clock) {
        this.connector = connector;
        this.repository = repository;
        this.cipher = cipher;
        this.clock = clock;
    }

    public URI start(UUID userId, HttpSession session) {
        if (!connector.isConfigured()) {
            throw new GoogleNotConfiguredException();
        }
        String state = randomToken();
        String verifier = randomToken();
        session.setAttribute(STATE_KEY, state);
        session.setAttribute(VERIFIER_KEY, verifier);
        session.setAttribute(USER_KEY, userId);
        return connector.authorizationUri(state, challengeOf(verifier));
    }

    public CallbackOutcome callback(
            UUID userId, HttpSession session, String state, String code, String error) {
        Object storedState = session.getAttribute(STATE_KEY);
        Object verifier = session.getAttribute(VERIFIER_KEY);
        Object storedUserId = session.getAttribute(USER_KEY);
        session.removeAttribute(STATE_KEY);
        session.removeAttribute(VERIFIER_KEY);
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
            refreshToken = connector.exchangeCode(code, (String) verifier).refreshToken();
        } catch (RuntimeException e) {
            log.warn("Google code exchange failed for user {}: {}", userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        if (refreshToken == null || refreshToken.isBlank()) {
            log.warn("Google issued no refresh token for user {}", userId);
            return CallbackOutcome.FAILED;
        }

        try {
            store(userId, refreshToken);
        } catch (RuntimeException e) {
            log.warn("Storing the Google connection failed for user {}: {}", userId, e.getClass().getSimpleName());
            return CallbackOutcome.FAILED;
        }
        return CallbackOutcome.CONNECTED;
    }

    private void store(UUID userId, String refreshToken) {
        Optional<ProviderConnection> existing =
            repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE);
        if (existing.isPresent()) {
            replaceToken(existing.get().id(), refreshToken);
            return;
        }
        UUID id = UUID.randomUUID();
        try {
            repository.insert(new ProviderConnection(
                id, userId, ProviderConnection.PROVIDER_GDRIVE, ProviderConnection.STATUS_ACTIVE,
                cipher.encrypt(id, refreshToken), null, clock.instant()));
        } catch (IntegrityConstraintViolationException | DuplicateKeyException e) {
            ProviderConnection winner = repository
                .findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE)
                .orElseThrow(() -> e);
            replaceToken(winner.id(), refreshToken);
        }
    }

    // The cipher binds the token to the row id, so the token is encrypted with the id of the row that stays.
    private void replaceToken(UUID id, String refreshToken) {
        repository.replaceToken(id, cipher.encrypt(id, refreshToken), null, clock.instant());
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
