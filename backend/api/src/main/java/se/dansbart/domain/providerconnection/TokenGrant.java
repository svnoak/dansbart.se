package se.dansbart.domain.providerconnection;

/** A null refreshToken means the provider issued no new token. */
public record TokenGrant(String accessToken, long expiresInSeconds, String refreshToken) {
}
