package se.dansbart.domain.providerconnection;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.PROVIDER_CONNECTIONS;

@Repository
public class ProviderConnectionJooqRepository {

    private final DSLContext dsl;

    public ProviderConnectionJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void insert(ProviderConnection connection) {
        if (connection.id() == null) {
            throw new IllegalArgumentException("A provider connection needs an id");
        }
        dsl.insertInto(PROVIDER_CONNECTIONS)
            .set(PROVIDER_CONNECTIONS.ID, connection.id())
            .set(PROVIDER_CONNECTIONS.USER_ID, connection.userId())
            .set(PROVIDER_CONNECTIONS.PROVIDER, connection.provider())
            .set(PROVIDER_CONNECTIONS.STATUS, connection.status())
            .set(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN, connection.encryptedRefreshToken())
            .set(PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT, toOffset(connection.refreshTokenExpiresAt()))
            .set(PROVIDER_CONNECTIONS.LAST_REFRESHED_AT, toOffset(connection.lastRefreshedAt()))
            .execute();
    }

    public Optional<ProviderConnection> findById(UUID id) {
        return dsl.selectFrom(PROVIDER_CONNECTIONS)
            .where(PROVIDER_CONNECTIONS.ID.eq(id))
            .fetchOptional(this::toConnection);
    }

    public Optional<ProviderConnection> findByUserAndProvider(UUID userId, String provider) {
        return dsl.selectFrom(PROVIDER_CONNECTIONS)
            .where(PROVIDER_CONNECTIONS.USER_ID.eq(userId))
            .and(PROVIDER_CONNECTIONS.PROVIDER.eq(provider))
            .fetchOptional(this::toConnection);
    }

    public List<ProviderConnection> findActiveDueForRefresh(Instant expiryCutoff, Instant staleBefore) {
        var expiresSoon = PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT.isNotNull()
            .and(PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT.lt(toOffset(expiryCutoff)));
        var staleWithoutExpiry = PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT.isNull()
            .and(PROVIDER_CONNECTIONS.LAST_REFRESHED_AT.lt(toOffset(staleBefore)));
        return dsl.selectFrom(PROVIDER_CONNECTIONS)
            .where(PROVIDER_CONNECTIONS.STATUS.eq(ProviderConnection.STATUS_ACTIVE))
            .and(expiresSoon.or(staleWithoutExpiry))
            .fetch(this::toConnection);
    }

    public boolean updateToken(
            UUID id,
            byte[] expectedEncryptedRefreshToken,
            byte[] encryptedRefreshToken,
            Instant expiresAt,
            Instant lastRefreshedAt) {
        return dsl.update(PROVIDER_CONNECTIONS)
            .set(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN, encryptedRefreshToken)
            .set(PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT,
                DSL.coalesce(DSL.val(toOffset(expiresAt), PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT),
                    PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT))
            .set(PROVIDER_CONNECTIONS.LAST_REFRESHED_AT, toOffset(lastRefreshedAt))
            .set(PROVIDER_CONNECTIONS.UPDATED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(PROVIDER_CONNECTIONS.ID.eq(id))
            .and(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN.eq(expectedEncryptedRefreshToken))
            .execute() > 0;
    }

    public boolean markNeedsReconnect(UUID id, byte[] expectedEncryptedRefreshToken) {
        return dsl.update(PROVIDER_CONNECTIONS)
            .set(PROVIDER_CONNECTIONS.STATUS, ProviderConnection.STATUS_NEEDS_RECONNECT)
            .set(PROVIDER_CONNECTIONS.UPDATED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(PROVIDER_CONNECTIONS.ID.eq(id))
            .and(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN.eq(expectedEncryptedRefreshToken))
            .execute() > 0;
    }

    public void replaceToken(UUID id, byte[] encryptedRefreshToken, Instant refreshTokenExpiresAt, Instant lastRefreshedAt) {
        dsl.update(PROVIDER_CONNECTIONS)
            .set(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN, encryptedRefreshToken)
            .set(PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT, toOffset(refreshTokenExpiresAt))
            .set(PROVIDER_CONNECTIONS.LAST_REFRESHED_AT, toOffset(lastRefreshedAt))
            .set(PROVIDER_CONNECTIONS.STATUS, ProviderConnection.STATUS_ACTIVE)
            .set(PROVIDER_CONNECTIONS.UPDATED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(PROVIDER_CONNECTIONS.ID.eq(id))
            .execute();
    }

    private ProviderConnection toConnection(Record record) {
        return new ProviderConnection(
            record.get(PROVIDER_CONNECTIONS.ID),
            record.get(PROVIDER_CONNECTIONS.USER_ID),
            record.get(PROVIDER_CONNECTIONS.PROVIDER),
            record.get(PROVIDER_CONNECTIONS.STATUS),
            record.get(PROVIDER_CONNECTIONS.ENCRYPTED_REFRESH_TOKEN),
            toInstant(record.get(PROVIDER_CONNECTIONS.REFRESH_TOKEN_EXPIRES_AT)),
            toInstant(record.get(PROVIDER_CONNECTIONS.LAST_REFRESHED_AT)));
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static Instant toInstant(OffsetDateTime time) {
        return time == null ? null : time.toInstant();
    }
}
