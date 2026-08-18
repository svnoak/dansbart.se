package se.dansbart.voter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

/**
 * Resolves the current request's voter identity once (authenticated principal, else
 * X-Voter-ID header) and stores it on the request-scoped {@link VoterContext}.
 */
@Component
public class VoterContextInterceptor implements HandlerInterceptor {

    private final VoterContext voterContext;

    public VoterContextInterceptor(VoterContext voterContext) {
        this.voterContext = voterContext;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID userId = (auth != null && auth.getPrincipal() instanceof UUID uuid) ? uuid : null;

        UUID voterId;
        if (userId != null) {
            voterId = userId;
        } else {
            voterId = parseUuidOrNull(request.getHeader("X-Voter-ID"));
        }

        voterContext.setVoterId(voterId);
        voterContext.setUserId(userId);
        voterContext.setAuthenticated(userId != null);
        return true;
    }

    private UUID parseUuidOrNull(String s) {
        if (s == null) return null;
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
