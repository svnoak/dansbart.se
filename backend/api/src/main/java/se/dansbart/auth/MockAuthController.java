package se.dansbart.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserService;

import java.io.IOException;
import java.util.List;

@RestController
@Profile("local")
@RequestMapping("/sso")
public class MockAuthController {

    private final UserService userService;

    public MockAuthController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/initiate")
    public void initiate(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Create or find a mock user for local development
        User user = userService.findOrCreate("mock_discourse_id", "localdev", "Local Developer");

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user.getId(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        new HttpSessionSecurityContextRepository().saveContext(context, request, response);

        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", "/");
    }
}
