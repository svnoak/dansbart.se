package se.dansbart.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserService;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Controller
@Profile("!local & !test")
@RequestMapping("/sso")
public class DiscourseConnectController {

    private final DiscourseConnectService discourseConnectService;
    private final UserService userService;

    public DiscourseConnectController(DiscourseConnectService discourseConnectService, UserService userService) {
        this.discourseConnectService = discourseConnectService;
        this.userService = userService;
    }

    @GetMapping("/initiate")
    public void initiate(HttpSession session, HttpServletResponse response) throws IOException {
        String redirectUrl = discourseConnectService.buildInitiateUrl(session);
        response.sendRedirect(redirectUrl);
    }

    @GetMapping("/callback")
    public void callback(
            @RequestParam("sso") String sso,
            @RequestParam("sig") String sig,
            HttpSession session,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        Map<String, String> params;
        try {
            params = discourseConnectService.verifyAndExtract(sso, sig, session);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "SSO verification failed");
        }

        String discourseId = params.get("external_id");
        String username = params.getOrDefault("username", discourseId);
        String name = params.getOrDefault("name", username);

        if (discourseId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing external_id in SSO payload");
        }

        User user = userService.findOrCreate(discourseId, username, name);

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user.getId(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        new HttpSessionSecurityContextRepository().saveContext(context, request, response);

        response.sendRedirect(discourseConnectService.getSuccessUrl());
    }
}
