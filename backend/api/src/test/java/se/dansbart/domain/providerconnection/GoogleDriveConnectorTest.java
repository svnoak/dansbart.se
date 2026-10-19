package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

class GoogleDriveConnectorTest {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String CLIENT_ID = "client-id";
    private static final String CLIENT_SECRET = "client-secret";
    private static final String REDIRECT_URI = "https://dansbart.se/callback";

    private MockRestServiceServer server;
    private GoogleDriveConnector connector;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        connector = new GoogleDriveConnector(builder, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    }

    @Test
    void identifiesAsGoogleDriveWithPkce() {
        assertEquals("GDRIVE", connector.provider());
        assertEquals("google", connector.slug());
        assertTrue(connector.usesPkce());
    }

    @Test
    void buildsTheConsentUrlWithDriveFileOfflineAccessAndPkce() {
        URI uri = connector.authorizationUri("state-1", "challenge-1");

        assertEquals("https", uri.getScheme());
        assertEquals("accounts.google.com", uri.getHost());
        assertEquals("/o/oauth2/v2/auth", uri.getPath());
        MultiValueMap<String, String> query = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        assertEquals(CLIENT_ID, decoded(query, "client_id"));
        assertEquals(REDIRECT_URI, decoded(query, "redirect_uri"));
        assertEquals("code", decoded(query, "response_type"));
        assertEquals("https://www.googleapis.com/auth/drive.file", decoded(query, "scope"));
        assertEquals("offline", decoded(query, "access_type"));
        assertEquals("consent", decoded(query, "prompt"));
        assertFalse(query.containsKey("include_granted_scopes"));
        assertEquals("state-1", decoded(query, "state"));
        assertEquals("challenge-1", decoded(query, "code_challenge"));
        assertEquals("S256", decoded(query, "code_challenge_method"));
    }

    @Test
    void exchangesACodeWithTheVerifierAndSecret() {
        server.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "grant_type", "authorization_code",
                        "code", "code-1",
                        "redirect_uri", REDIRECT_URI,
                        "client_id", CLIENT_ID,
                        "client_secret", CLIENT_SECRET,
                        "code_verifier", "verifier-1")))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a\",\"expires_in\":3599,\"refresh_token\":\"r\",\"token_type\":\"Bearer\"}",
                        MediaType.APPLICATION_JSON));

        TokenGrant grant = connector.exchangeCode("code-1", "verifier-1");

        assertEquals("a", grant.accessToken());
        assertEquals(3599L, grant.expiresInSeconds());
        assertEquals("r", grant.refreshToken());
        server.verify();
    }

    @Test
    void refreshesWithoutANewRefreshToken() throws Exception {
        server.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "grant_type", "refresh_token",
                        "refresh_token", "old-refresh",
                        "client_id", CLIENT_ID,
                        "client_secret", CLIENT_SECRET)))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a2\",\"expires_in\":3599,\"token_type\":\"Bearer\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withSuccess(
                        "{\"access_token\":\"a3\",\"expires_in\":3599,\"token_type\":\"Bearer\"}",
                        MediaType.APPLICATION_JSON));

        TokenGrant grant = connector.refreshAccess("old-refresh");
        RefreshedToken refreshed = connector.refresh("old-refresh");

        assertEquals("a2", grant.accessToken());
        assertNull(grant.refreshToken());
        assertEquals(new RefreshedToken(null, null), refreshed);
    }

    @Test
    void reportsAResponseWithoutAnAccessTokenAsAFailure() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withSuccess("{\"expires_in\":3599}", MediaType.APPLICATION_JSON));

        assertThrows(RuntimeException.class, () -> connector.refreshAccess("token"));
    }

    @Test
    void reportsARevokedTokenAsInvalidGrant() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\"}"));

        assertThrows(InvalidGrantException.class, () -> connector.refreshAccess("revoked"));
    }

    @Test
    void reportsOtherErrorsAsFailures() {
        server.expect(requestTo(TOKEN_URL))
                .andRespond(withStatus(BAD_REQUEST)
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
    void isConfiguredOnlyWithClientIdSecretAndRedirectUri() {
        RestClient.Builder builder = RestClient.builder();

        assertTrue(new GoogleDriveConnector(builder, "id", "secret", "uri").isConfigured());
        assertFalse(new GoogleDriveConnector(builder, "", "secret", "uri").isConfigured());
        assertFalse(new GoogleDriveConnector(builder, "id", " ", "uri").isConfigured());
        assertFalse(new GoogleDriveConnector(builder, "id", "secret", "").isConfigured());
    }

    private static String decoded(MultiValueMap<String, String> query, String name) {
        return java.net.URLDecoder.decode(query.getFirst(name), java.nio.charset.StandardCharsets.UTF_8);
    }

    private static MultiValueMap<String, String> formOf(String... keysAndValues) {
        org.springframework.util.LinkedMultiValueMap<String, String> form =
                new org.springframework.util.LinkedMultiValueMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            form.add(keysAndValues[i], keysAndValues[i + 1]);
        }
        return form;
    }
}
