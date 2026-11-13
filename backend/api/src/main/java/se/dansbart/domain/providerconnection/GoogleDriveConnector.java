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

@Component
public class GoogleDriveConnector implements OAuthConnector {

    private static final String PROVIDER = "GDRIVE";
    private static final String AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public GoogleDriveConnector(
            RestClient.Builder builder,
            @Value("${dansbart.google.client-id:}") String clientId,
            @Value("${dansbart.google.client-secret:}") String clientSecret,
            @Value("${dansbart.google.redirect-uri:}") String redirectUri) {
        this.restClient = builder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
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

    @Override
    public String slug() {
        return "google";
    }

    @Override
    public boolean usesPkce() {
        return true;
    }

    @Override
    public boolean isConfigured() {
        return !clientId.isBlank() && !clientSecret.isBlank() && !redirectUri.isBlank();
    }

    @Override
    public URI authorizationUri(String state, String codeChallenge) {
        return UriComponentsBuilder.fromUriString(AUTHORIZATION_URL)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", DRIVE_FILE_SCOPE)
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", state)
                .queryParam("code_challenge", codeChallenge)
                .queryParam("code_challenge_method", "S256")
                .encode()
                .build()
                .toUri();
    }

    @Override
    public TokenGrant exchangeCode(String code, String codeVerifier) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("code_verifier", codeVerifier);
        try {
            return requestToken(form);
        } catch (InvalidGrantException e) {
            throw new IllegalStateException("Google rejected the authorization code", e);
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
            throw new IllegalStateException("Google token response had no access token");
        }
        return new TokenGrant(response.accessToken(), response.expiresIn(), response.refreshToken());
    }

    private TokenResponse postForm(MultiValueMap<String, String> form) {
        return restClient.post()
                .uri(TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .exchange((request, result) -> {
                    if (result.getStatusCode().is2xxSuccessful()) {
                        return result.bodyTo(TokenResponse.class);
                    }
                    if (result.getStatusCode().value() == 400 && isInvalidGrant(result.bodyTo(ErrorResponse.class))) {
                        throw new InvalidGrantRuntimeException("Google reports the grant as invalid");
                    }
                    throw new IllegalStateException(
                            "Google token request failed with status " + result.getStatusCode().value());
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
