package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HiDriveConnectorTest {

    private static final String AUTHORIZATION_URL = "https://hidrive.example/client/authorize";
    private static final String TOKEN_URL = "https://hidrive.example/oauth2/token";
    private static final String CLIENT_ID = "client-id";
    private static final String CLIENT_SECRET = "client-secret";
    private static final String REDIRECT_URI = "https://dansbart.se/api/connections/hidrive/callback";

    private MockRestServiceServer server;
    private HiDriveConnector connector;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        connector = connector(builder, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, AUTHORIZATION_URL, TOKEN_URL);
    }

    private static HiDriveConnector connector(
            RestClient.Builder builder, String id, String secret, String redirect, String authUrl, String tokenUrl) {
        return new HiDriveConnector(builder, id, secret, redirect, authUrl, tokenUrl);
    }

    @Test
    void identifiesAsHiDriveWithoutPkce() {
        assertEquals(ProviderConnection.PROVIDER_HIDRIVE, connector.provider());
        assertEquals("hidrive", connector.slug());
        assertFalse(connector.usesPkce());
    }

    @Test
    void buildsTheConsentUrlFromTheConfiguredEndpointWithReadOnlyUserScope() {
        // The challenge is ignored even when a caller passes one.
        URI uri = connector.authorizationUri("state-1", "ignored-challenge");

        assertEquals("https", uri.getScheme());
        assertEquals("hidrive.example", uri.getHost());
        assertEquals("/client/authorize", uri.getPath());
        MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        assertEquals(CLIENT_ID, decoded(query, "client_id"));
        assertEquals(REDIRECT_URI, decoded(query, "redirect_uri"));
        assertEquals("code", decoded(query, "response_type"));
        assertEquals("user,ro", decoded(query, "scope"));
        assertEquals("state-1", decoded(query, "state"));
        assertFalse(query.containsKey("code_challenge"));
        assertFalse(query.containsKey("access_type"));
    }

    @Test
    void exchangesACodeWithTheSecretAndRedirectUri() {
        server.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "grant_type", "authorization_code",
                        "code", "code-1",
                        "redirect_uri", REDIRECT_URI,
                        "client_id", CLIENT_ID,
                        "client_secret", CLIENT_SECRET)))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a\",\"expires_in\":3600,\"refresh_token\":\"r\","
                            + "\"token_type\":\"Bearer\",\"scope\":\"user,ro\",\"userid\":\"u\",\"alias\":\"x\"}",
                        MediaType.APPLICATION_JSON));

        TokenGrant grant = connector.exchangeCode("code-1", null);

        assertEquals("a", grant.accessToken());
        assertEquals(3600L, grant.expiresInSeconds());
        assertEquals("r", grant.refreshToken());
        server.verify();
    }

    @Test
    void reportsARejectedCodeAsAFailureNotAsInvalidGrant() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\"}"));

        assertThrows(IllegalStateException.class, () -> connector.exchangeCode("stale", null));
    }

    @Test
    void refreshesAndKeepsTheOldRefreshTokenWhenNoneIsIssued() throws Exception {
        server.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "grant_type", "refresh_token",
                        "refresh_token", "old-refresh",
                        "client_id", CLIENT_ID,
                        "client_secret", CLIENT_SECRET)))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a2\",\"expires_in\":3600,\"token_type\":\"Bearer\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a3\",\"expires_in\":3600,\"refresh_token\":\"new-refresh\"}",
                        MediaType.APPLICATION_JSON));

        TokenGrant grant = connector.refreshAccess("old-refresh");
        RefreshedToken rotated = connector.refresh("old-refresh");

        assertEquals("a2", grant.accessToken());
        assertNull(grant.refreshToken());
        assertEquals(new RefreshedToken("new-refresh", null), rotated);
        server.verify();
    }

    @Test
    void reportsAResponseWithoutAnAccessTokenAsAFailure() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withSuccess("{\"expires_in\":3600}", MediaType.APPLICATION_JSON));

        assertThrows(IllegalStateException.class, () -> connector.refreshAccess("token"));
    }

    @Test
    void reportsARevokedTokenAsInvalidGrantOn400And401() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\",\"error_description\":\"revoked\"}"));
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\"}"));

        assertThrows(InvalidGrantException.class, () -> connector.refreshAccess("revoked"));
        assertThrows(InvalidGrantException.class, () -> connector.refreshAccess("revoked"));
    }

    @Test
    void reportsOtherErrorsAsFailures() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_client\"}"));
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(INTERNAL_SERVER_ERROR));

        Exception invalidClient = assertThrows(Exception.class, () -> connector.refreshAccess("token"));
        Exception serverError = assertThrows(Exception.class, () -> connector.refreshAccess("token"));

        assertTrue(invalidClient instanceof RuntimeException);
        assertFalse(invalidClient instanceof InvalidGrantException);
        assertTrue(serverError instanceof RuntimeException);
        assertFalse(serverError instanceof InvalidGrantException);
    }

    @Test
    void isConfiguredOnlyWithClientSecretRedirectAndBothEndpoints() {
        RestClient.Builder builder = RestClient.builder();

        assertTrue(connector(builder, "id", "secret", "uri", "auth", "token").isConfigured());
        assertFalse(connector(builder, "", "secret", "uri", "auth", "token").isConfigured());
        assertFalse(connector(builder, "id", " ", "uri", "auth", "token").isConfigured());
        assertFalse(connector(builder, "id", "secret", "", "auth", "token").isConfigured());
        assertFalse(connector(builder, "id", "secret", "uri", "", "token").isConfigured());
        assertFalse(connector(builder, "id", "secret", "uri", "auth", "").isConfigured());
    }

    private static String decoded(MultiValueMap<String, String> query, String name) {
        return URLDecoder.decode(query.getFirst(name), StandardCharsets.UTF_8);
    }

    private static MultiValueMap<String, String> formOf(String... keysAndValues) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            form.add(keysAndValues[i], keysAndValues[i + 1]);
        }
        return form;
    }
}
