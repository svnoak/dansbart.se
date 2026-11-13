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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthConnectionServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");
    private static final URI PKCE_URI = URI.create("https://accounts.example/auth");
    private static final URI PLAIN_URI = URI.create("https://plain.example/authorize");
    private static final String REFRESH_TOKEN = "refresh-token";
    private static final String CODE = "authorization-code";

    @Mock
    private OAuthConnector pkce;

    @Mock
    private OAuthConnector plain;

    @Mock
    private ProviderConnectionJooqRepository repository;

    private TokenCipher cipher;
    private OAuthConnectionService service;
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
        service = serviceWith(cipher);
        session = new MockHttpSession();
        userId = UUID.randomUUID();
        lenientSlugs();
    }

    private OAuthConnectionService serviceWith(TokenCipher tokenCipher) {
        return new OAuthConnectionService(
            List.of(pkce, plain), new ConnectionTokenStore(repository, tokenCipher, Clock.fixed(NOW, ZoneOffset.UTC)));
    }

    private void lenientSlugs() {
        org.mockito.Mockito.lenient().when(pkce.slug()).thenReturn("pkce");
        org.mockito.Mockito.lenient().when(pkce.provider()).thenReturn("GDRIVE");
        org.mockito.Mockito.lenient().when(pkce.usesPkce()).thenReturn(true);
        org.mockito.Mockito.lenient().when(plain.slug()).thenReturn("plain");
        org.mockito.Mockito.lenient().when(plain.provider()).thenReturn("HIDRIVE");
    }

    /** Starts the PKCE flow and remembers the state and the verifier the service stored. */
    private void startPkceAs(UUID person) {
        when(pkce.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        when(pkce.authorizationUri(stateCaptor.capture(), anyString())).thenReturn(PKCE_URI);
        service.start("pkce", person, session);
        state = stateCaptor.getValue();
        verifier = (String) session.getAttribute("connect.GDRIVE.verifier");
    }

    private void startPlainAs(UUID person) {
        when(plain.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        when(plain.authorizationUri(stateCaptor.capture(), isNull())).thenReturn(PLAIN_URI);
        service.start("plain", person, session);
        state = stateCaptor.getValue();
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
    void startWithPkceStoresStateVerifierAndPersonAndSendsTheChallenge() throws Exception {
        when(pkce.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> challengeCaptor = ArgumentCaptor.forClass(String.class);
        when(pkce.authorizationUri(stateCaptor.capture(), challengeCaptor.capture())).thenReturn(PKCE_URI);

        URI result = service.start("pkce", userId, session);

        assertThat(result).isEqualTo(PKCE_URI);
        assertThat(session.getAttribute("connect.GDRIVE.state")).isEqualTo(stateCaptor.getValue());
        assertThat(session.getAttribute("connect.GDRIVE.user")).isEqualTo(userId);
        String storedVerifier = (String) session.getAttribute("connect.GDRIVE.verifier");
        assertThat(storedValues(session)).hasSize(3);
        assertThat(storedVerifier).hasSizeBetween(43, 128).matches("[A-Za-z0-9_-]+");
        assertThat(stateCaptor.getValue()).hasSizeGreaterThanOrEqualTo(22).matches("[A-Za-z0-9_-]+");
        assertThat(challengeCaptor.getValue()).isEqualTo(challengeOf(storedVerifier));
    }

    @Test
    void startWithoutPkceStoresOnlyStateAndPerson() {
        startPlainAs(userId);

        assertThat(session.getAttribute("connect.HIDRIVE.state")).isEqualTo(state);
        assertThat(session.getAttribute("connect.HIDRIVE.user")).isEqualTo(userId);
        assertThat(storedValues(session)).hasSize(2);
    }

    @Test
    void startKeepsTheStateOfOneProviderWhileAnotherStarts() {
        startPlainAs(userId);
        String plainState = state;
        startPkceAs(userId);

        assertThat(session.getAttribute("connect.HIDRIVE.state")).isEqualTo(plainState);
        assertThat(session.getAttribute("connect.GDRIVE.state")).isEqualTo(state);
        assertThat(state).isNotEqualTo(plainState);
    }

    @Test
    void startRefusesAnUnknownProvider() {
        assertThatThrownBy(() -> service.start("box", userId, session))
            .isInstanceOf(UnknownProviderException.class)
            .hasMessageContaining("box");
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void startRefusesWhenTheProviderIsNotConfigured() {
        when(plain.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.start("plain", userId, session))
            .isInstanceOf(ProviderNotConfiguredException.class)
            .hasMessageContaining("HIDRIVE");

        verify(plain, never()).authorizationUri(any(), any());
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackRefusesAnUnknownProvider() {
        assertThatThrownBy(() -> service.callback("box", userId, session, "s", CODE, null))
            .isInstanceOf(UnknownProviderException.class);
    }

    @Test
    void callbackRejectsAWrongOrMissingStateAndExchangesNothing() {
        CallbackOutcome withoutStart = service.callback("pkce", userId, session, "any-state", CODE, null);

        startPkceAs(userId);
        CallbackOutcome withWrongState = service.callback("pkce", userId, session, state + "x", CODE, null);

        assertThat(withoutStart).isEqualTo(CallbackOutcome.REJECTED);
        assertThat(withWrongState).isEqualTo(CallbackOutcome.REJECTED);
        verify(pkce, never()).exchangeCode(any(), any());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackRejectsTheStateOfAnotherProvider() {
        startPlainAs(userId);

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.REJECTED);
        verify(pkce, never()).exchangeCode(any(), any());
        assertThat(session.getAttribute("connect.HIDRIVE.state")).isEqualTo(state);
    }

    @Test
    void callbackRejectsADifferentOrAnonymousPerson() {
        startPkceAs(userId);
        CallbackOutcome other = service.callback("pkce", UUID.randomUUID(), session, state, CODE, null);

        startPkceAs(userId);
        CallbackOutcome anonymous = service.callback("pkce", null, session, state, CODE, null);

        assertThat(other).isEqualTo(CallbackOutcome.REJECTED);
        assertThat(anonymous).isEqualTo(CallbackOutcome.REJECTED);
        verify(pkce, never()).exchangeCode(any(), any());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackClearsTheProviderSessionEveryTime() {
        startPkceAs(userId);
        service.callback("pkce", userId, session, "wrong", CODE, null);
        assertThat(storedValues(session)).isEmpty();

        startPkceAs(userId);
        service.callback("pkce", userId, session, state, null, "access_denied");
        assertThat(storedValues(session)).isEmpty();

        startPkceAs(userId);
        when(pkce.exchangeCode(anyString(), anyString())).thenReturn(new TokenGrant("access", 3600, null));
        service.callback("pkce", userId, session, state, CODE, null);
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackReportsADeclinedConsent() {
        startPlainAs(userId);

        CallbackOutcome outcome = service.callback("plain", userId, session, state, null, "access_denied");

        assertThat(outcome).isEqualTo(CallbackOutcome.DECLINED);
        verify(plain, never()).exchangeCode(any(), any());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackFailsWithoutACode() {
        startPlainAs(userId);

        CallbackOutcome outcome = service.callback("plain", userId, session, state, " ", null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verify(plain, never()).exchangeCode(any(), any());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackPassesTheVerifierToAPkceConnectorAndNullToTheOthers() {
        startPkceAs(userId);
        when(pkce.exchangeCode(CODE, verifier)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, "GDRIVE")).thenReturn(Optional.empty());
        CallbackOutcome pkceOutcome = service.callback("pkce", userId, session, state, CODE, null);

        startPlainAs(userId);
        when(plain.exchangeCode(CODE, null)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, "HIDRIVE")).thenReturn(Optional.empty());
        CallbackOutcome plainOutcome = service.callback("plain", userId, session, state, CODE, null);

        assertThat(pkceOutcome).isEqualTo(CallbackOutcome.CONNECTED);
        assertThat(plainOutcome).isEqualTo(CallbackOutcome.CONNECTED);
        verify(pkce).exchangeCode(CODE, verifier);
        verify(plain).exchangeCode(CODE, null);
    }

    @Test
    void callbackReportsAFailedExchange() {
        startPkceAs(userId);
        when(pkce.exchangeCode(eq(CODE), eq(verifier))).thenThrow(new IllegalStateException("token request failed"));

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackReportsAMissingRefreshToken() {
        startPkceAs(userId);
        when(pkce.exchangeCode(eq(CODE), eq(verifier))).thenReturn(new TokenGrant("access", 3600, null));

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackStoresANewConnectionEncryptedWithItsId() {
        startPlainAs(userId);
        when(plain.exchangeCode(CODE, null)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, "HIDRIVE")).thenReturn(Optional.empty());

        CallbackOutcome outcome = service.callback("plain", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<ProviderConnection> inserted = ArgumentCaptor.forClass(ProviderConnection.class);
        verify(repository).insert(inserted.capture());
        ProviderConnection connection = inserted.getValue();
        assertThat(connection.userId()).isEqualTo(userId);
        assertThat(connection.provider()).isEqualTo("HIDRIVE");
        assertThat(connection.status()).isEqualTo(ProviderConnection.STATUS_ACTIVE);
        assertThat(connection.refreshTokenExpiresAt()).isNull();
        assertThat(connection.lastRefreshedAt()).isEqualTo(NOW);
        assertThat(cipher.decrypt(connection.id(), connection.encryptedRefreshToken())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReplacesTheTokenOfAnExistingConnection() {
        startPkceAs(userId);
        when(pkce.exchangeCode(CODE, verifier)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        UUID existingId = UUID.randomUUID();
        when(repository.findByUserAndProvider(userId, "GDRIVE")).thenReturn(Optional.of(existing(existingId)));

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(repository).replaceToken(eq(existingId), bytes.capture(), isNull(), eq(NOW));
        verify(repository, never()).insert(any());
        assertThat(cipher.decrypt(existingId, bytes.getValue())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReplacesWhenASimultaneousConnectCreatedTheRow() {
        startPkceAs(userId);
        when(pkce.exchangeCode(CODE, verifier)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        UUID winnerId = UUID.randomUUID();
        when(repository.findByUserAndProvider(userId, "GDRIVE"))
            .thenReturn(Optional.empty(), Optional.of(existing(winnerId)));
        doThrow(new DuplicateKeyException("duplicate")).when(repository).insert(any(ProviderConnection.class));

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(repository).replaceToken(eq(winnerId), bytes.capture(), isNull(), eq(NOW));
        assertThat(cipher.decrypt(winnerId, bytes.getValue())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReportsAFailedStore() {
        startPkceAs(userId);
        when(pkce.exchangeCode(CODE, verifier)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, "GDRIVE")).thenReturn(Optional.empty());
        doThrow(new RuntimeException("database down")).when(repository).insert(any(ProviderConnection.class));

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
    }

    @Test
    void callbackReportsAFailedStoreWithoutAnEncryptionKey() {
        service = serviceWith(new TokenCipher(""));
        startPkceAs(userId);
        when(pkce.exchangeCode(CODE, verifier)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, "GDRIVE")).thenReturn(Optional.empty());

        CallbackOutcome outcome = service.callback("pkce", userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verify(repository, never()).insert(any());
    }

    private ProviderConnection existing(UUID id) {
        return new ProviderConnection(
            id, userId, "GDRIVE", ProviderConnection.STATUS_ACTIVE,
            cipher.encrypt(id, "old-token"), null, NOW.minusSeconds(100));
    }
}
