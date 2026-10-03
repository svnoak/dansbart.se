package se.dansbart.domain.providerconnection;

import java.time.Instant;

/** A null refreshToken means the provider issued no new token. */
public record RefreshedToken(String refreshToken, Instant refreshTokenExpiresAt) {
}
