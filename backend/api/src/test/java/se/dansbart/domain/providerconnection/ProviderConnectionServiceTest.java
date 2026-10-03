package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ProviderConnectionServiceTest {

    private static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");
    private static final String STORED_TOKEN = "stored-refresh-token";

    @Mock
    private ProviderConnectionJooqRepository repository;

    private TokenCipher cipher;
    private Clock clock;
    private ProviderConnection connection;

    @BeforeEach
    void setUp() {
        byte[] keyBytes = new byte[32];
        for (int i = 0; i < keyBytes.length; i++) {
            keyBytes[i] = (byte) i;
        }
        cipher = new TokenCipher(Base64.getEncoder().encodeToString(keyBytes));
        clock = Clock.fixed(NOW, ZoneOffset.UTC);
        UUID id = UUID.randomUUID();
        connection = new ProviderConnection(
            id, UUID.randomUUID(), "GDRIVE", "ACTIVE",
            cipher.encrypt(id, STORED_TOKEN), NOW.plusSeconds(100), NOW.minusSeconds(100));
    }

    private ProviderConnectionService serviceWith(ProviderConnector... connectors) {
        return new ProviderConnectionService(repository, cipher, List.of(connectors), clock);
    }

    @Test
    void storesTheNewTokenEncryptedWithTheNewExpiry() {
        Instant newExpiry = NOW.plusSeconds(3600);
        FakeConnector connector = new FakeConnector("GDRIVE", token -> new RefreshedToken("new-token", newExpiry));

        serviceWith(connector).refreshConnection(connection);

        ArgumentCaptor<byte[]> encrypted = ArgumentCaptor.forClass(byte[].class);
        verify(repository).updateToken(
            org.mockito.ArgumentMatchers.eq(connection.id()),
            org.mockito.ArgumentMatchers.eq(connection.encryptedRefreshToken()), encrypted.capture(),
            org.mockito.ArgumentMatchers.eq(newExpiry), org.mockito.ArgumentMatchers.eq(NOW));
        assertThat(cipher.decrypt(connection.id(), encrypted.getValue())).isEqualTo("new-token");
        assertThat(connector.receivedTokens).containsExactly(STORED_TOKEN);
    }

    @Test
    void keepsTheStoredTokenWhenTheProviderIssuesNone() {
        Instant newExpiry = NOW.plusSeconds(3600);
        FakeConnector connector = new FakeConnector("GDRIVE", token -> new RefreshedToken(null, newExpiry));

        serviceWith(connector).refreshConnection(connection);

        verify(repository).updateToken(
            org.mockito.ArgumentMatchers.eq(connection.id()),
            org.mockito.ArgumentMatchers.eq(connection.encryptedRefreshToken()),
            org.mockito.ArgumentMatchers.eq(connection.encryptedRefreshToken()),
            org.mockito.ArgumentMatchers.eq(newExpiry), org.mockito.ArgumentMatchers.eq(NOW));
    }

    @Test
    void marksTheConnectionForReconnectOnInvalidGrant() {
        FakeConnector connector = new FakeConnector("GDRIVE", token -> {
            throw new InvalidGrantException("invalid_grant");
        });

        serviceWith(connector).refreshConnection(connection);

        verify(repository).markNeedsReconnect(connection.id(), connection.encryptedRefreshToken());
        verify(repository, never()).updateToken(any(), any(), any(), any(), any());
    }

    @Test
    void leavesTheConnectionUnchangedOnOtherErrors() {
        FakeConnector connector = new FakeConnector("GDRIVE", token -> {
            throw new RuntimeException("provider unavailable");
        });

        assertThatCode(() -> serviceWith(connector).refreshConnection(connection)).doesNotThrowAnyException();

        verifyNoInteractions(repository);
    }

    @Test
    void usesTheConnectorOfTheConnectionsProvider() {
        FakeConnector gdrive = new FakeConnector("GDRIVE", token -> new RefreshedToken("gdrive-token", null));
        FakeConnector hidrive = new FakeConnector("HIDRIVE", token -> new RefreshedToken("hidrive-token", null));

        serviceWith(gdrive, hidrive).refreshConnection(connection);

        assertThat(gdrive.receivedTokens).hasSize(1);
        assertThat(hidrive.receivedTokens).isEmpty();
    }

    @Test
    void leavesTheConnectionUnchangedWithoutAConnector() {
        assertThatCode(() -> serviceWith().refreshConnection(connection)).doesNotThrowAnyException();

        verifyNoInteractions(repository);
    }

    @FunctionalInterface
    private interface Refresh {
        RefreshedToken apply(String token) throws Exception;
    }

    private static class FakeConnector implements ProviderConnector {
        private final String provider;
        private final Refresh refresh;
        private final List<String> receivedTokens = new ArrayList<>();

        FakeConnector(String provider, Refresh refresh) {
            this.provider = provider;
            this.refresh = refresh;
        }

        @Override
        public String provider() {
            return provider;
        }

        @Override
        public RefreshedToken refresh(String refreshToken) throws InvalidGrantException {
            receivedTokens.add(refreshToken);
            try {
                return refresh.apply(refreshToken);
            } catch (InvalidGrantException | RuntimeException e) {
                throw e;
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
