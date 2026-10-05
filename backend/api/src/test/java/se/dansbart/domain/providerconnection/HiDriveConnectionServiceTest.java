package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpSession;

import java.net.URI;
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
class HiDriveConnectionServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");
    private static final URI AUTHORIZATION_URI = URI.create("https://hidrive.example/client/authorize");
    private static final String REFRESH_TOKEN = "hidrive-refresh-token";
    private static final String CODE = "authorization-code";

    @Mock
    private HiDriveConnector connector;

    @Mock
    private ProviderConnectionJooqRepository repository;

    private TokenCipher cipher;
    private HiDriveConnectionService service;
    private MockHttpSession session;
    private UUID userId;
    private String state;

    @BeforeEach
    void setUp() {
        byte[] keyBytes = new byte[32];
        for (int i = 0; i < keyBytes.length; i++) {
            keyBytes[i] = (byte) i;
        }
        cipher = new TokenCipher(Base64.getEncoder().encodeToString(keyBytes));
        service = new HiDriveConnectionService(
            connector, new ConnectionTokenStore(repository, cipher, Clock.fixed(NOW, ZoneOffset.UTC)));
        session = new MockHttpSession();
        userId = UUID.randomUUID();
    }

    private void startAs(UUID person) {
        when(connector.isConfigured()).thenReturn(true);
        ArgumentCaptor<String> stateCaptor = ArgumentCaptor.forClass(String.class);
        when(connector.authorizationUri(stateCaptor.capture())).thenReturn(AUTHORIZATION_URI);
        service.start(person, session);
        state = stateCaptor.getValue();
    }

    private static List<Object> storedValues(MockHttpSession target) {
        List<Object> values = new ArrayList<>();
        for (String name : Collections.list(target.getAttributeNames())) {
            values.add(target.getAttribute(name));
        }
        return values;
    }

    @Test
    void startStoresTheStateAndThePersonAndRedirectsToHiDrive() {
        startAs(userId);

        assertThat(storedValues(session)).containsExactlyInAnyOrder(state, userId);
        assertThat(state).hasSizeGreaterThanOrEqualTo(22).matches("[A-Za-z0-9_-]+");
        when(connector.authorizationUri(anyString())).thenReturn(AUTHORIZATION_URI);
        assertThat(service.start(userId, session)).isEqualTo(AUTHORIZATION_URI);
    }

    @Test
    void startRefusesWhenHiDriveIsNotConfigured() {
        when(connector.isConfigured()).thenReturn(false);
        when(connector.provider()).thenReturn("HIDRIVE");

        assertThatThrownBy(() -> service.start(userId, session))
            .isInstanceOf(ProviderNotConfiguredException.class)
            .hasMessageContaining("HIDRIVE");

        verify(connector, never()).authorizationUri(anyString());
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackRejectsAWrongOrMissingStateAndExchangesNothing() {
        CallbackOutcome withoutStart = service.callback(userId, session, "any-state", CODE, null);

        startAs(userId);
        CallbackOutcome withWrongState = service.callback(userId, session, state + "x", CODE, null);

        assertThat(withoutStart).isEqualTo(CallbackOutcome.REJECTED);
        assertThat(withWrongState).isEqualTo(CallbackOutcome.REJECTED);
        verify(connector, never()).exchangeCode(anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackRejectsADifferentOrAnonymousPerson() {
        startAs(userId);
        CallbackOutcome other = service.callback(UUID.randomUUID(), session, state, CODE, null);

        startAs(userId);
        CallbackOutcome anonymous = service.callback(null, session, state, CODE, null);

        assertThat(other).isEqualTo(CallbackOutcome.REJECTED);
        assertThat(anonymous).isEqualTo(CallbackOutcome.REJECTED);
        verify(connector, never()).exchangeCode(anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackClearsTheSessionEveryTime() {
        startAs(userId);
        service.callback(userId, session, "wrong", CODE, null);
        assertThat(storedValues(session)).isEmpty();

        startAs(userId);
        service.callback(userId, session, state, null, "access_denied");
        assertThat(storedValues(session)).isEmpty();

        startAs(userId);
        when(connector.exchangeCode(anyString())).thenReturn(new TokenGrant("access", 3600, null));
        service.callback(userId, session, state, CODE, null);
        assertThat(storedValues(session)).isEmpty();
    }

    @Test
    void callbackReportsADeclinedConsent() {
        startAs(userId);

        CallbackOutcome outcome = service.callback(userId, session, state, null, "access_denied");

        assertThat(outcome).isEqualTo(CallbackOutcome.DECLINED);
        verify(connector, never()).exchangeCode(anyString());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackFailsWithoutACode() {
        startAs(userId);

        CallbackOutcome outcome = service.callback(userId, session, state, " ", null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verify(connector, never()).exchangeCode(any());
        verifyNoInteractions(repository);
    }

    @Test
    void callbackReportsAFailedExchange() {
        startAs(userId);
        when(connector.exchangeCode(CODE)).thenThrow(new IllegalStateException("HiDrive token request failed"));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackReportsAMissingRefreshToken() {
        startAs(userId);
        when(connector.exchangeCode(CODE)).thenReturn(new TokenGrant("access", 3600, null));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
        verifyNoInteractions(repository);
    }

    @Test
    void callbackStoresANewHiDriveConnectionEncryptedWithItsId() {
        startAs(userId);
        when(connector.exchangeCode(CODE)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_HIDRIVE))
            .thenReturn(Optional.empty());

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<ProviderConnection> inserted = ArgumentCaptor.forClass(ProviderConnection.class);
        verify(repository).insert(inserted.capture());
        ProviderConnection connection = inserted.getValue();
        assertThat(connection.userId()).isEqualTo(userId);
        assertThat(connection.provider()).isEqualTo(ProviderConnection.PROVIDER_HIDRIVE);
        assertThat(connection.status()).isEqualTo(ProviderConnection.STATUS_ACTIVE);
        assertThat(connection.refreshTokenExpiresAt()).isNull();
        assertThat(connection.lastRefreshedAt()).isEqualTo(NOW);
        assertThat(cipher.decrypt(connection.id(), connection.encryptedRefreshToken())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReplacesTheTokenOfAnExistingHiDriveConnection() {
        startAs(userId);
        when(connector.exchangeCode(CODE)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        UUID existingId = UUID.randomUUID();
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_HIDRIVE))
            .thenReturn(Optional.of(new ProviderConnection(
                existingId, userId, ProviderConnection.PROVIDER_HIDRIVE, ProviderConnection.STATUS_ACTIVE,
                cipher.encrypt(existingId, "old-token"), null, NOW.minusSeconds(100))));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.CONNECTED);
        ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
        verify(repository).replaceToken(eq(existingId), bytes.capture(), isNull(), eq(NOW));
        verify(repository, never()).insert(any());
        assertThat(cipher.decrypt(existingId, bytes.getValue())).isEqualTo(REFRESH_TOKEN);
    }

    @Test
    void callbackReportsAFailedStore() {
        startAs(userId);
        when(connector.exchangeCode(CODE)).thenReturn(new TokenGrant("access", 3600, REFRESH_TOKEN));
        when(repository.findByUserAndProvider(userId, ProviderConnection.PROVIDER_HIDRIVE))
            .thenReturn(Optional.empty());
        org.mockito.Mockito.doThrow(new RuntimeException("database down"))
            .when(repository).insert(any(ProviderConnection.class));

        CallbackOutcome outcome = service.callback(userId, session, state, CODE, null);

        assertThat(outcome).isEqualTo(CallbackOutcome.FAILED);
    }
}
