package se.dansbart.domain.providerconnection;

import java.net.URI;

/**
 * A provider that people connect through the OAuth authorization code flow.
 *
 * {@link OAuthConnectionService} runs the flow for every connector. A connector that returns
 * {@code true} from {@link #usesPkce()} receives a code challenge and a code verifier; the others
 * receive {@code null} for both.
 */
public interface OAuthConnector extends ProviderConnector {

    /** The name of the provider in {@code /api/connections/{slug}/start}, for example {@code google}. */
    String slug();

    /** Whether the OAuth client is configured, so that people can connect the provider. */
    boolean isConfigured();

    default boolean usesPkce() {
        return false;
    }

    URI authorizationUri(String state, String codeChallenge);

    TokenGrant exchangeCode(String code, String codeVerifier);
}
