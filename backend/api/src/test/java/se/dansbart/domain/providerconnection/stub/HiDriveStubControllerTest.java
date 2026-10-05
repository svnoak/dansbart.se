package se.dansbart.domain.providerconnection.stub;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockMvcClientHttpRequestFactory;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import se.dansbart.domain.providerconnection.HiDriveConnector;
import se.dansbart.domain.providerconnection.InvalidGrantException;
import se.dansbart.domain.providerconnection.RefreshedToken;
import se.dansbart.domain.providerconnection.TokenGrant;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HiDriveStubControllerTest {

    private static final String CLIENT_ID = "lokal-dansbart";
    private static final String CLIENT_SECRET = "lokal-hemlighet";
    private static final String REDIRECT_URI = "http://localhost:5173/api/connections/hidrive/callback";
    private static final String FILE = HiDriveStubLibrary.HOME + "/Polskor/Bingsjöpolska.wav";

    private MockMvc mockMvc;
    private HiDriveConnector connector;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
            .standaloneSetup(new HiDriveStubController(new HiDriveStubLibrary(), CLIENT_ID, CLIENT_SECRET, REDIRECT_URI))
            .build();
        // The real connector talks to the stub through MockMvc, so the two agree on the wire format.
        RestClient.Builder builder = RestClient.builder()
            .requestFactory(new MockMvcClientHttpRequestFactory(mockMvc));
        connector = new HiDriveConnector(builder, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI,
            "http://localhost:8000/stub/hidrive/client/authorize", "http://localhost:8000/stub/hidrive/oauth2/token");
    }

    @Test
    void consentPageOffersAllowAndDenyForTheConfiguredClient() throws Exception {
        URI consent = connector.authorizationUri("state-1");

        MvcResult result = mockMvc.perform(get(consent))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
            .andReturn();

        String html = result.getResponse().getContentAsString();
        assertThat(html).contains("Tillåt").contains("Neka").contains("user,ro")
            .contains("/stub/hidrive/client/decide?decision=allow&amp;state=state-1")
            .contains("/stub/hidrive/client/decide?decision=deny&amp;state=state-1");
    }

    @Test
    void consentPageRefusesAnotherClientOrRedirectUri() throws Exception {
        mockMvc.perform(get("/stub/hidrive/client/authorize")
                .param("client_id", "someone-else").param("redirect_uri", REDIRECT_URI)
                .param("response_type", "code").param("state", "s"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/stub/hidrive/client/authorize")
                .param("client_id", CLIENT_ID).param("redirect_uri", "https://evil.example/")
                .param("response_type", "code").param("state", "s"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void allowSendsTheBrowserBackWithACodeAndTheState() throws Exception {
        String location = mockMvc.perform(get("/stub/hidrive/client/decide")
                .param("decision", "allow").param("state", "state-1"))
            .andExpect(status().isFound())
            .andReturn().getResponse().getHeader(HttpHeaders.LOCATION);

        URI back = URI.create(location);
        var query = UriComponentsBuilder.fromUri(back).build().getQueryParams();
        assertThat(back.toString()).startsWith(REDIRECT_URI + "?");
        assertThat(query.getFirst("code")).startsWith(HiDriveStubController.CODE_PREFIX);
        assertThat(query.getFirst("state")).isEqualTo("state-1");
        assertThat(query).doesNotContainKey("error");
    }

    @Test
    void denySendsTheBrowserBackWithAccessDenied() throws Exception {
        String location = mockMvc.perform(get("/stub/hidrive/client/decide")
                .param("decision", "deny").param("state", "state-1"))
            .andExpect(status().isFound())
            .andReturn().getResponse().getHeader(HttpHeaders.LOCATION);

        var query = UriComponentsBuilder.fromUriString(location).build().getQueryParams();
        assertThat(query.getFirst("error")).isEqualTo("access_denied");
        assertThat(query.getFirst("state")).isEqualTo("state-1");
        assertThat(query).doesNotContainKey("code");
    }

    @Test
    void theConnectorExchangesAStubCodeAndRefreshesTheToken() throws Exception {
        TokenGrant grant = connector.exchangeCode(HiDriveStubController.CODE_PREFIX + "abc");

        assertThat(grant.accessToken()).startsWith(HiDriveStubController.ACCESS_PREFIX);
        assertThat(grant.expiresInSeconds()).isEqualTo(HiDriveStubController.EXPIRES_IN_SECONDS);
        assertThat(grant.refreshToken()).startsWith(HiDriveStubController.REFRESH_PREFIX);

        TokenGrant refreshed = connector.refreshAccess(grant.refreshToken());
        assertThat(refreshed.accessToken()).startsWith(HiDriveStubController.ACCESS_PREFIX)
            .isNotEqualTo(grant.accessToken());
        assertThat(connector.refresh(grant.refreshToken())).isEqualTo(new RefreshedToken(null, null));
    }

    @Test
    void theConnectorSeesAForeignRefreshTokenAsInvalidGrant() {
        assertThatThrownBy(() -> connector.refreshAccess("not-from-the-stub"))
            .isInstanceOf(InvalidGrantException.class);
        assertThatThrownBy(() -> connector.exchangeCode("not-a-stub-code"))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void tokenEndpointRefusesAWrongSecret() throws Exception {
        mockMvc.perform(post("/stub/hidrive/oauth2/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("grant_type", "refresh_token").param("refresh_token", HiDriveStubController.REFRESH_PREFIX + "x")
                .param("client_id", CLIENT_ID).param("client_secret", "wrong"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("invalid_client"));
    }

    @Test
    void listsTheHomeFolderAndItsSubfolders() throws Exception {
        mockMvc.perform(get("/stub/hidrive/2.1/dir").header(HttpHeaders.AUTHORIZATION, bearer()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.path").value(HiDriveStubLibrary.HOME))
            .andExpect(jsonPath("$.type").value("dir"))
            .andExpect(jsonPath("$.members[?(@.name=='Polskor')].type").value("dir"))
            .andExpect(jsonPath("$.members[?(@.name=='Schottis')].type").value("dir"))
            .andExpect(jsonPath("$.members[?(@.name=='Gånglåt från Äppelbo.wav')].mime_type").value("audio/wav"));

        mockMvc.perform(get("/stub/hidrive/2.1/dir").header(HttpHeaders.AUTHORIZATION, bearer())
                .param("path", HiDriveStubLibrary.HOME + "/Polskor/"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Polskor"))
            .andExpect(jsonPath("$.members.length()").value(2))
            .andExpect(jsonPath("$.members[0].path").value(FILE))
            .andExpect(jsonPath("$.members[0].size").value(32044));

        mockMvc.perform(get("/stub/hidrive/2.1/dir").header(HttpHeaders.AUTHORIZATION, bearer())
                .param("path", "/users/someone.else"))
            .andExpect(status().isNotFound());
    }

    @Test
    void downloadsAFileWholeOrByRange() throws Exception {
        byte[] whole = mockMvc.perform(get("/stub/hidrive/2.1/file").param("path", FILE)
                .header(HttpHeaders.AUTHORIZATION, bearer()))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
            .andExpect(content().contentType("audio/wav"))
            .andReturn().getResponse().getContentAsByteArray();

        assertThat(new String(Arrays.copyOf(whole, 4), StandardCharsets.US_ASCII)).isEqualTo("RIFF");
        assertThat(whole).hasSize(32044);

        byte[] part = mockMvc.perform(get("/stub/hidrive/2.1/file").param("path", FILE)
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .header(HttpHeaders.RANGE, "bytes=0-3"))
            .andExpect(status().isPartialContent())
            .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-3/32044"))
            .andReturn().getResponse().getContentAsByteArray();

        assertThat(part).isEqualTo(Arrays.copyOf(whole, 4));
    }

    @Test
    void apiRefusesAMissingOrForeignTokenAndAnUnknownFile() throws Exception {
        mockMvc.perform(get("/stub/hidrive/2.1/dir"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value(401));
        mockMvc.perform(get("/stub/hidrive/2.1/file").param("path", FILE)
                .header(HttpHeaders.AUTHORIZATION, "Bearer ya29.google"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/stub/hidrive/2.1/file").param("path", HiDriveStubLibrary.HOME + "/saknas.wav")
                .header(HttpHeaders.AUTHORIZATION, bearer()))
            .andExpect(status().isNotFound());
    }

    @Test
    void decodedConsentLinkKeepsTheStateIntact() throws Exception {
        String state = UUID.randomUUID() + "_-";
        String html = mockMvc.perform(get(connector.authorizationUri(state)))
            .andReturn().getResponse().getContentAsString();
        String href = html.substring(html.indexOf("decision=allow"));
        href = href.substring(0, href.indexOf('"'));
        assertThat(URLDecoder.decode(href.replace("&amp;", "&"), StandardCharsets.UTF_8))
            .isEqualTo("decision=allow&state=" + state);
    }

    private static String bearer() {
        return "Bearer " + HiDriveStubController.ACCESS_PREFIX + "test";
    }
}
