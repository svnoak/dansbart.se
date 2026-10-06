package se.dansbart.domain.providerconnection;

import org.jooq.exception.IntegrityConstraintViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

/** Stores the refresh token of a provider connection, one row per person and provider. */
@Component
public class ConnectionTokenStore {

    private final ProviderConnectionJooqRepository repository;
    private final TokenCipher cipher;
    private final Clock clock;

    public ConnectionTokenStore(ProviderConnectionJooqRepository repository, TokenCipher cipher, Clock clock) {
        this.repository = repository;
        this.cipher = cipher;
        this.clock = clock;
    }

    /** Inserts the connection, or replaces the token of the row that already exists. */
    public void store(UUID userId, String provider, String refreshToken) {
        Optional<ProviderConnection> existing = repository.findByUserAndProvider(userId, provider);
        if (existing.isPresent()) {
            replaceToken(existing.get().id(), refreshToken);
            return;
        }
        UUID id = UUID.randomUUID();
        try {
            repository.insert(new ProviderConnection(
                id, userId, provider, ProviderConnection.STATUS_ACTIVE,
                cipher.encrypt(id, refreshToken), null, clock.instant()));
        } catch (IntegrityConstraintViolationException | DuplicateKeyException e) {
            ProviderConnection winner = repository
                .findByUserAndProvider(userId, provider)
                .orElseThrow(() -> e);
            replaceToken(winner.id(), refreshToken);
        }
    }

    // The cipher binds the token to the row id, so the token is encrypted with the id of the row that stays.
    private void replaceToken(UUID id, String refreshToken) {
        repository.replaceToken(id, cipher.encrypt(id, refreshToken), null, clock.instant());
    }
}
