package se.dansbart.domain.providerconnection.stub;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A stand-in for HiDrive for local development, so the whole connect flow can be clicked through
 * without a HiDrive account: consent page, token endpoint, folder listing and file download.
 *
 * The stub is stateless. It issues codes and tokens with a recognisable prefix and accepts any
 * token that carries the prefix, so a restart of the API does not invalidate a stored connection.
 * Nothing here has been verified against HiDrive; see CONTRIBUTING.md for what to check live.
 */
@RestController
@Profile("local")
@RequestMapping("/stub/hidrive")
@CrossOrigin(
    origins = {"http://localhost:5173", "http://localhost:8080"},
    allowedHeaders = {HttpHeaders.AUTHORIZATION, HttpHeaders.RANGE, HttpHeaders.CONTENT_TYPE},
    exposedHeaders = {HttpHeaders.CONTENT_RANGE, HttpHeaders.ACCEPT_RANGES, HttpHeaders.CONTENT_LENGTH})
public class HiDriveStubController {

    static final String CODE_PREFIX = "stub-code-";
    static final String ACCESS_PREFIX = "stub-access-";
    static final String REFRESH_PREFIX = "stub-refresh-";
    static final long EXPIRES_IN_SECONDS = 3600;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final HiDriveStubLibrary library;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;

    public HiDriveStubController(
            @Value("${dansbart.hidrive.client-id:}") String clientId,
            @Value("${dansbart.hidrive.client-secret:}") String clientSecret,
            @Value("${dansbart.hidrive.redirect-uri:}") String redirectUri) {
        this(new HiDriveStubLibrary(), clientId, clientSecret, redirectUri);
    }

    HiDriveStubController(HiDriveStubLibrary library, String clientId, String clientSecret, String redirectUri) {
        this.library = library;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    /** The consent page. The person picks Tillåt or Neka, and the stub sends the browser back. */
    @GetMapping(value = "/client/authorize", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> authorize(
            @RequestParam(name = "client_id", required = false) String requestedClientId,
            @RequestParam(name = "redirect_uri", required = false) String requestedRedirectUri,
            @RequestParam(name = "response_type", required = false) String responseType,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String state) {
        if (!clientId.equals(requestedClientId)) {
            return page(HttpStatus.UNAUTHORIZED, "Okänd klient", "client_id stämmer inte med HIDRIVE_CLIENT_ID.");
        }
        if (!redirectUri.equals(requestedRedirectUri)) {
            return page(HttpStatus.BAD_REQUEST, "Fel återsändningsadress",
                "redirect_uri stämmer inte med HIDRIVE_REDIRECT_URI.");
        }
        if (!"code".equals(responseType)) {
            return page(HttpStatus.BAD_REQUEST, "Fel svarstyp", "response_type måste vara code.");
        }
        String allow = decisionLink("allow", state);
        String deny = decisionLink("deny", state);
        String body = """
            <p>Det här är en låtsasversion av HiDrive för lokal utveckling.</p>
            <p><strong>dansbart.se</strong> vill läsa dina filer i HiDrive (omfattning <code>%s</code>).</p>
            <p>
              <a href="%s" style="padding:.6em 1.2em;background:#1a6b3c;color:#fff;border-radius:.4em;text-decoration:none">Tillåt</a>
              &nbsp;
              <a href="%s" style="padding:.6em 1.2em;background:#eee;color:#222;border-radius:.4em;text-decoration:none">Neka</a>
            </p>
            """.formatted(HtmlUtils.htmlEscape(scope == null ? "" : scope), allow, deny);
        return page(HttpStatus.OK, "Anslut HiDrive", body);
    }

    /** Sends the browser back to the application with a code or with an error. */
    @GetMapping("/client/decide")
    public ResponseEntity<Void> decide(
            @RequestParam String decision,
            @RequestParam(required = false) String state) {
        UriComponentsBuilder back = UriComponentsBuilder.fromUriString(redirectUri);
        if ("allow".equals(decision)) {
            back.queryParam("code", CODE_PREFIX + randomToken());
        } else {
            back.queryParam("error", "access_denied");
        }
        if (state != null) {
            back.queryParam("state", state);
        }
        URI location = back.encode().build().toUri();
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }

    @PostMapping(value = "/oauth2/token",
        consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> token(
            @RequestParam(name = "grant_type", required = false) String grantType,
            @RequestParam(name = "client_id", required = false) String requestedClientId,
            @RequestParam(name = "client_secret", required = false) String requestedClientSecret,
            @RequestParam(name = "redirect_uri", required = false) String requestedRedirectUri,
            @RequestParam(required = false) String code,
            @RequestParam(name = "refresh_token", required = false) String refreshToken) {
        if (!clientId.equals(requestedClientId) || !clientSecret.equals(requestedClientSecret)) {
            return oauthError(HttpStatus.UNAUTHORIZED, "invalid_client", "Fel client_id eller client_secret.");
        }
        return switch (grantType == null ? "" : grantType) {
            case "authorization_code" -> {
                if (code == null || !code.startsWith(CODE_PREFIX)) {
                    yield oauthError(HttpStatus.BAD_REQUEST, "invalid_grant", "Koden kommer inte från stubben.");
                }
                if (!redirectUri.equals(requestedRedirectUri)) {
                    yield oauthError(HttpStatus.BAD_REQUEST, "invalid_grant", "redirect_uri stämmer inte.");
                }
                yield ResponseEntity.ok(grant(REFRESH_PREFIX + randomToken()));
            }
            case "refresh_token" -> {
                if (refreshToken == null || !refreshToken.startsWith(REFRESH_PREFIX)) {
                    yield oauthError(HttpStatus.BAD_REQUEST, "invalid_grant", "Okänd eller återkallad refresh token.");
                }
                yield ResponseEntity.ok(grant(null));
            }
            default -> oauthError(HttpStatus.BAD_REQUEST, "unsupported_grant_type", "Okänd grant_type.");
        };
    }

    /** Lists a folder. Mirrors the fields of HiDrive's {@code GET /2.1/dir}. */
    @GetMapping(value = "/2.1/dir", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> dir(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestParam(required = false) String path) {
        if (!bearerIsValid(authorization)) {
            return apiError(HttpStatus.UNAUTHORIZED, "Åtkomsttoken saknas eller är ogiltig.");
        }
        Optional<HiDriveStubLibrary.Listing> listing = library.list(path);
        if (listing.isEmpty()) {
            return apiError(HttpStatus.NOT_FOUND, "Mappen finns inte.");
        }
        List<Map<String, Object>> members = listing.get().members().stream()
            .map(entry -> entry.type().equals("dir")
                ? Map.<String, Object>of("name", entry.name(), "path", entry.path(), "type", "dir")
                : Map.<String, Object>of("name", entry.name(), "path", entry.path(), "type", "file",
                    "size", entry.size(), "mime_type", entry.mimeType()))
            .toList();
        return ResponseEntity.ok(Map.of(
            "path", listing.get().path(),
            "name", listing.get().name(),
            "type", "dir",
            "members", members));
    }

    /** Downloads a file. Spring answers a Range request with 206 and a Content-Range. */
    @GetMapping("/2.1/file")
    public ResponseEntity<Resource> file(
            @RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestParam(required = false) String path) {
        if (!bearerIsValid(authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<byte[]> bytes = path == null ? Optional.empty() : library.file(path);
        if (bytes.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
            .contentType(MediaType.parseMediaType("audio/wav"))
            .body(new ByteArrayResource(bytes.get()));
    }

    private static boolean bearerIsValid(String authorization) {
        return authorization != null && authorization.startsWith("Bearer " + ACCESS_PREFIX);
    }

    private static Map<String, Object> grant(String refreshToken) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("access_token", ACCESS_PREFIX + randomToken());
        body.put("token_type", "Bearer");
        body.put("expires_in", EXPIRES_IN_SECONDS);
        body.put("scope", "user,ro");
        body.put("userid", "stub-user");
        body.put("alias", "lokal.dansare");
        if (refreshToken != null) {
            body.put("refresh_token", refreshToken);
        }
        return body;
    }

    private static ResponseEntity<Map<String, Object>> oauthError(HttpStatus status, String error, String text) {
        return ResponseEntity.status(status).body(Map.of("error", error, "error_description", text));
    }

    private static ResponseEntity<Map<String, Object>> apiError(HttpStatus status, String text) {
        return ResponseEntity.status(status).body(Map.of("code", status.value(), "msg", text));
    }

    private String decisionLink(String decision, String state) {
        UriComponentsBuilder link = UriComponentsBuilder.fromPath("/stub/hidrive/client/decide")
            .queryParam("decision", decision);
        if (state != null) {
            link.queryParam("state", state);
        }
        return HtmlUtils.htmlEscape(link.encode().build().toUriString());
    }

    private static ResponseEntity<String> page(HttpStatus status, String title, String body) {
        String html = """
            <!doctype html>
            <html lang="sv">
            <head><meta charset="utf-8"><title>%1$s</title></head>
            <body style="font-family:sans-serif;max-width:32em;margin:3em auto;line-height:1.5">
            <h1>%1$s</h1>
            %2$s
            </body>
            </html>
            """.formatted(HtmlUtils.htmlEscape(title), body);
        return ResponseEntity.status(status).contentType(MediaType.TEXT_HTML).body(html);
    }

    private static String randomToken() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
