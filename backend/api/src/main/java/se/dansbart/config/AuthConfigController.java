package se.dansbart.config;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping(value = "/api/config", produces = MediaType.APPLICATION_JSON_VALUE)
public class AuthConfigController {

    @GetMapping("/auth")
    public Map<String, Object> getAuthConfig() {
        return Map.of(
            "authMethod", "discourse",
            "loginUrl", "/sso/initiate"
        );
    }
}
