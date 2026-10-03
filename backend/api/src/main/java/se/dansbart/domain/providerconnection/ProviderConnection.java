package se.dansbart.domain.providerconnection;

import java.time.Instant;
import java.util.UUID;

public record ProviderConnection(
    UUID id,
    UUID userId,
    String provider,
    String status,
    byte[] encryptedRefreshToken,
    Instant refreshTokenExpiresAt,
    Instant lastRefreshedAt
) {
    public static final String PROVIDER_GDRIVE = "GDRIVE";
    public static final String PROVIDER_HIDRIVE = "HIDRIVE";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_NEEDS_RECONNECT = "NEEDS_RECONNECT";
}
