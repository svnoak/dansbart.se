package se.dansbart.domain.providerconnection;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ProviderConnectionService {

    private final ProviderConnectionJooqRepository repository;
    private final TokenCipher cipher;
    private final List<ProviderConnector> connectors;
    private final Clock clock;

    public ProviderConnectionService(
            ProviderConnectionJooqRepository repository,
            TokenCipher cipher,
            List<ProviderConnector> connectors,
            Clock clock) {
        this.repository = repository;
        this.cipher = cipher;
        this.connectors = connectors;
        this.clock = clock;
    }

    public void refreshConnection(ProviderConnection connection) {
        UUID id = connection.id();
        ProviderConnector connector = connectors.stream()
            .filter(candidate -> candidate.provider().equals(connection.provider()))
            .findFirst()
            .orElse(null);
        if (connector == null) {
            log.warn("No connector for provider {}, connection {}", connection.provider(), id);
            return;
        }
        try {
            String storedToken = cipher.decrypt(id, connection.encryptedRefreshToken());
            RefreshedToken refreshed = connector.refresh(storedToken);
            byte[] encryptedToken = refreshed.refreshToken() == null
                ? connection.encryptedRefreshToken()
                : cipher.encrypt(id, refreshed.refreshToken());
            boolean updated = repository.updateToken(
                id, connection.encryptedRefreshToken(), encryptedToken,
                refreshed.refreshTokenExpiresAt(), clock.instant());
            if (!updated) {
                log.info("Connection {} changed during the token refresh, update skipped", id);
            }
        } catch (InvalidGrantException e) {
            if (!repository.markNeedsReconnect(id, connection.encryptedRefreshToken())) {
                log.info("Connection {} changed during the token refresh, update skipped", id);
            }
        } catch (Exception e) {
            log.warn("Token refresh failed for connection {}: {}", id, e.getClass().getSimpleName());
        }
    }
}
