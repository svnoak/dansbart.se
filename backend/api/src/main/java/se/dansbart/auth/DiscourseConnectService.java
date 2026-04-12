package se.dansbart.auth;

import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

@Service
@Profile("!local & !test")
public class DiscourseConnectService {

    private static final String NONCE_SESSION_KEY = "discourse_sso_nonce";
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    @Value("${discourse.connect.url}")
    private String discourseUrl;

    @Value("${discourse.connect.secret}")
    private String secret;

    @Value("${discourse.connect.return-url}")
    private String returnUrl;

    @Value("${discourse.connect.success-url}")
    private String successUrl;

    public String getSuccessUrl() {
        return successUrl;
    }

    public String buildInitiateUrl(HttpSession session) {
        String nonce = generateNonce();
        session.setAttribute(NONCE_SESSION_KEY, nonce);

        String payload = "nonce=" + nonce + "&return_sso_url=" + encode(returnUrl);
        String base64Payload = Base64.getEncoder().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String sig = hmacSha256Hex(base64Payload, secret);

        return discourseUrl + "?sso=" + encode(base64Payload) + "&sig=" + sig;
    }

    public Map<String, String> verifyAndExtract(String ssoParam, String sigParam, HttpSession session) {
        String expectedSig = hmacSha256Hex(ssoParam, secret);
        if (!expectedSig.equals(sigParam)) {
            throw new IllegalArgumentException("Invalid SSO signature");
        }

        String decoded = new String(Base64.getDecoder().decode(ssoParam), StandardCharsets.UTF_8);
        Map<String, String> params = parseQueryString(decoded);

        String sessionNonce = (String) session.getAttribute(NONCE_SESSION_KEY);
        if (sessionNonce == null || !sessionNonce.equals(params.get("nonce"))) {
            throw new IllegalArgumentException("Nonce mismatch");
        }

        session.removeAttribute(NONCE_SESSION_KEY);
        return params;
    }

    private String generateNonce() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String hmacSha256Hex(String data, String key) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Failed to compute HMAC", e);
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private Map<String, String> parseQueryString(String query) {
        Map<String, String> result = new HashMap<>();
        for (String pair : query.split("&")) {
            int idx = pair.indexOf('=');
            if (idx > 0) {
                String key = java.net.URLDecoder.decode(pair.substring(0, idx), StandardCharsets.UTF_8);
                String value = java.net.URLDecoder.decode(pair.substring(idx + 1), StandardCharsets.UTF_8);
                result.put(key, value);
            }
        }
        return result;
    }
}
