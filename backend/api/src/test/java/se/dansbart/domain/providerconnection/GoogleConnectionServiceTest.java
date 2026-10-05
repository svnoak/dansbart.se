package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.mock.web.MockHttpSession;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GoogleConnectionServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");
    private static final URI AUTHORIZATION_URI = URI.create("https://accounts.example/auth");
    private static final String REFRESH_TOKEN = "google-refresh-token";
    private static final String CODE = "authorization-code";

    @Mock
    private GoogleDriveConnector connector;

    @Mock
    private ProviderConnectionJooqRepository repository;

    private TokenCipher cipher;
    private GoogleConnectionService service;
    private MockHttpSession session;
    private UUID userId;
    private String state;
    private String verifier;

    @BeforeEach
    void setUp() {
        byte[] keyBytes = new byte[32];
        for (int i = 0; i < keyBytes.length; i++) {
            keyBytes[i] = (byte) i;
        }
        cipher = new TokenCipher(Base64.getEncoder().encodeToString(keyBytes));
        service = new GoogleConnectionService(
            connector, repository, cipher, Clock.fixed(NOW, ZoneOffset.UTC));
        session = new MockHttpSession();
        userId = UUID.randomUUID();
    }

    private void startAs(UUID person, MockHttpSession target) {
        when(connector.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> challengeCaptor = ArgumentCaptor.forClass(String.class);
        when(connector.authorizationUri(stateCaptor.capture(), challengeCaptor.capture()))
            .thenReturn(AUTHORIZATION_URI);
        service.start(person, target);
        state = stateCaptor.getValue();
        verifier = target.getAttributeNames().hasMoreElements()
            ? storedValues(target).stream()
                .filter(v -> v instanceof String s && !s.equals(state))
                .map(String.class::cast)
                .findFirst().orElseThrow()
            : null;
    }

    private static List<Object> storedValues(MockHttpSession target) {
        List<Object> values = new ArrayList<>();
        for (String name : Collections.list(target.getAttributeNames())) {
            values.add(target.getAttribute(name));
        }
        return values;
    }

    private static String challengeOf(String verifier) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
            .digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    @Test
    void startStoresStateVerifierAndPersonAndSendsTheChallenge() throws Exception {
        when(connector.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> challengeCaptor = ArgumentCaptor.forClass(String.class);
        when(connector.authorizationUri(stateCaptor.capture(), challengeCaptor.capture()))
            .thenReturn(AUTHORIZATION_URI);

        URI result = service.start(userId, session);

        assertThat(result).isEqualTo(AUTHORIZATION_URI);
        List<Object> stored = storedValues(session);
        assertThat(stored).hasSize(3).contains(stateCaptor.getValue(), userId);
        String storedVerifier = stored.stream()
            .filter(v -> v instanceof String s && !s.equals(stateCaptor.getValue()))
            .map(String.class::cast)
            .findFirst().orElseThrow();
        assertThat(storedVerifier).hasSizeBetween(43, 128).matches("[A-Za-z0-9_-]+");
        assertThat(stateCaptor.getValue()).hasSizeGreaterThanOrEqualTo(22).matches("[A-Za-z0-9_-]+");
        assertThat(challengeCaptor.getValue()).isEqualTo(challengeOf(storedVerifier));
    }

    @Test
    void startRefusesWhenGoogleIsNotConfigured() {
        when(connector.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.start(userId, session))
            .isInstanceOf(GoogleNotConfiguredException.class);

        verify(connector, never()).authorizationUri(anyString(), anyString());
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackRejectsAWrongOrMissingStateAndExchangesNothing() {
        CallbackOutcome withoutStart = service.callback(userId, session, "any-state", CODE, null);

        startAs(userId, session);
        CallbackOutcome withWrongState = service.callback(userId, session, state + "x", CODE, null);

        assertThat(withoutStart).isEqualTo(CallbackOutcome.REJECTED);
        assertThat(withWrongState).isEqualTo(CallbackOutcome.REJECTED);
        verify(connector, never()).exchangeCode(anyString(), anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackRejectsADifferentPerson() {
        startAs(userId, session);

        CallbackOutcome other = service.callback(UUID.randomUUID(), session, state, CODE, null);

        assertThat(other).isEqualTo(CallbackOutcome.REJECTED);
        verify(connector, never()).exchangeCode(anyString(), anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackRejectsAnAnonymousPerson() {
        startAs(userId, session);

        CallbackOutcome anonymous = service.callback(null, session, state, CODE, null);

        assertThat(anonymous).isEqualTo(CallbackOutcome.REJECTED);
        verify(connector, never()).exchangeCode(anyString(), anyString());
    }

    @Test
    void callbackClearsTheSessionEveryTime() {
        startAs(userId, session);
        service.callback(userId, session, "wrong", CODE, null);
        assertThat(storedValues(session)).isEmpty();

        startAs(userId, session);
        service.callback(userId, session, state, null, "access_denied");
        assertThat(storedValues(session)).isEmpty();

        startAs(userId, session);
        when(connector.exchangeCode(anyString(), anyString()))
            .thenReturn(new TokenGrant("access", 3600, null));
        service.callback(userId, session, state, CODE, null);
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackReportsADeclinedConsent() {
        startAs(userId, session);

        CallbackOutcome outcome = service.callback(userId, session, state, null, "access_denied");

        assertThat(outcome).isEqualTo(CallbackOutcome.DECLINED);
        verify(connector, never()).exchangeCode(anyString(), anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackReportsAFailedExchange() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenThrow(new IllegalStateException("Google token request failed"));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackReportsAMissingRefreshToken() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, null));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackStoresANewConnectionEncryptedWithItsId() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE))
            .thenReturn(Optional.empty());

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<ProviderConnection> inserted = ArgumentCaptor.forClass(ProviderConnection.class);
        verify(repository).insert(inserted.capture());
        ProviderConnection connection = inserted.getValue();
        assertThat(connection.userId()).isEqualTo(userId);
        assertThat(connection.provider()).isEqualTo(ProviderConnection.PROVIDER_GDRIVE);
        assertThat(connection.status()).isEqualTo(ProviderConnection.STATUS_ACTIVE);
        assertThat(connection.refreshTokenExpiresAt()).isNull();
        assertThat(connection.lastRefreshedAt()).isEqualTo(NOW);
        assertThat(cipher.decrypt(connection.id(), connection.encryptedRefreshToken()))
            .isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReplacesTheTokenOfAnExistingConnection() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        UUID existingId = UUID.randomUUID();
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE))
            .thenReturn(Optional.of(existing(existingId)));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(repository).replaceToken(eq(existingId), bytes.capture(), isNull(), eq(NOW));
        verify(repository, never()).insert(any());
        assertThat(cipher.decrypt(existingId, bytes.getValue())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReplacesWhenASimultaneousConnectCreatedTheRow() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        UUID winnerId = UUID.randomUUID();
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE))
            .thenReturn(Optional.empty(), Optional.of(existing(winnerId)));
        org.mockito.Mockito.doThrow(new DuplicateKeyException("duplicate"))
            .when(repository).insert(any(ProviderConnection.class));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(repository).replaceToken(eq(winnerId), bytes.capture(), isNull(), eq(NOW));
        assertThat(cipher.decrypt(winnerId, bytes.getValue())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReportsAFailedStore() {
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE))
            .thenReturn(Optional.empty());
        org.mockito.Mockito.doThrow(new RuntimeException("database down"))
            .when(repository).insert(any(ProviderConnection.class));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
    }

    @Test
    void callbackReportsAFailedStoreWithoutAnEncryptionKey() {
        service = new GoogleConnectionService(
            connector, repository, new TokenCipher(""), Clock.fixed(NOW, ZoneOffset.UTC));
        startAs(userId, session);
        when(connector.exchangeCode(eq(CODE), eq(verifier)))
            .thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_GDRIVE))
            .thenReturn(Optional.empty());

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verify(repository, never()).insert(any());
    }

    @Test
    void callbackFailsWithoutACode() {
        startAs(userId, session);

        CallbackOutcome outcome = service.callback(userId, session, state, " ", null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verify(connector, never()).exchangeCode(any(), any());
        verifyNoInteractions(repository);
    }

    private ProviderConnection existing(UUID id) {
        return new ProviderConnection(
            id, userId, ProviderConnection.PROVIDER_GDRIVE, ProviderConnection.STATUS_ACTIVE,
            cipher.encrypt(id, "old-token"), null, NOW.minusSeconds(100));
    }
}
