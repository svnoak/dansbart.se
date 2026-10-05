package se.dansbart.domain.providerconnection;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

/**
 * OAuth client for STRATO HiDrive.
 *
 * The authorization and token URLs come from configuration so that the local profile can point
 * them at {@code HiDriveStubController}. The defaults are the production endpoints of HiDrive.
 * HiDrive scopes are written as {@code role,access}; {@code user,ro} reads the files of the person
 * who connects and nothing else.
 */
@Component
public class HiDriveConnector implements ProviderConnector {

    private static final String PROVIDER = ProviderConnection.PROVIDER_HIDRIVE;
    private static final String SCOPE = "user,ro";

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final String authorizationUrl;
    private final String tokenUrl;

    public HiDriveConnector(
            RestClient.Builder builder,
            @Value("${dansbart.hidrive.client-id:}") String clientId,
            @Value("${dansbart.hidrive.client-secret:}") String clientSecret,
            @Value("${dansbart.hidrive.redirect-uri:}") String redirectUri,
            @Value("${dansbart.hidrive.authorization-url:https://my.hidrive.com/client/authorize}")
            String authorizationUrl,
            @Value("${dansbart.hidrive.token-url:https://my.hidrive.com/oauth2/token}") String tokenUrl) {
        this.restClient = builder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.authorizationUrl = authorizationUrl;
        this.tokenUrl = tokenUrl;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") long expiresIn,
            @JsonProperty("refresh_token") String refreshToken) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ErrorResponse(String error) {
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    public boolean isConfigured() {
        return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank()
                && !authorizationUrl.isBlank() && !tokenUrl.isBlank();
    }

    public URI authorizationUri(String state) {
        return UriComponentsBuilder.fromUriString(authorizationUrl)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", SCOPE)
                .queryParam("state", state)
                .encode()
                .build()
                .toUri();
    }

    public TokenGrant exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        try {
            return requestToken(form);
        } catch (InvalidGrantException e) {
            throw new IllegalStateException("HiDrive rejected the authorization code", e);
        }
    }

    public TokenGrant refreshAccess(String refreshToken) throws InvalidGrantException {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        return requestToken(form);
    }

    @Override
    public RefreshedToken refresh(String refreshToken) throws InvalidGrantException {
        TokenGrant grant = refreshAccess(refreshToken);
        return new RefreshedToken(grant.refreshToken(), null);
    }

    private TokenGrant requestToken(MultiValueMap<String, String> form) throws InvalidGrantException {
        TokenResponse response;
        try {
            response = postForm(form);
        } catch (InvalidGrantRuntimeException e) {
            throw new InvalidGrantException(e.getMessage());
        }
        if (response == null || response.accessToken() == null) {
            throw new IllegalStateException("HiDrive token response had no access token");
        }
        return new TokenGrant(response.accessToken(), response.expiresIn(), response.refreshToken());
    }

    private TokenResponse postForm(MultiValueMap<String, String> form) {
        return restClient.post()
                .uri(tokenUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .exchange((request, result) -> {
                    if (result.getStatusCode().is2xxSuccessful()) {
                        return result.bodyTo(TokenResponse.class);
                    }
                    int status = result.getStatusCode().value();
                    if ((status == 400 || status == 401) && isInvalidGrant(result.bodyTo(ErrorResponse.class))) {
                        throw new InvalidGrantRuntimeException("HiDrive reports the grant as invalid");
                    }
                    throw new IllegalStateException("HiDrive token request failed with status " + status);
                });
    }

    private static boolean isInvalidGrant(ErrorResponse error) {
        return error != null && "invalid_grant".equals(error.error());
    }

    private static class InvalidGrantRuntimeException extends RuntimeException {
        InvalidGrantRuntimeException(String message) {
            super(message);
        }
    }
}
