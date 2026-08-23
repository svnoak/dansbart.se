package se.dansbart.voter;

import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Per-request voter identity, resolved once by {@link VoterContextInterceptor} and
 * consumed by services instead of every controller re-parsing X-Voter-ID/the auth
 * principal individually.
 */
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class VoterContext {

    private UUID voterId;
    private UUID userId;
    private boolean authenticated;

    public UUID getVoterId() {
        return voterId;
    }

    public UUID getUserId() {
        return userId;
    }

    public boolean isAuthenticated() {
        return authenticated;
    }

    void setVoterId(UUID voterId) {
        this.voterId = voterId;
    }

    void setUserId(UUID userId) {
        this.userId = userId;
    }

    void setAuthenticated(boolean authenticated) {
        this.authenticated = authenticated;
    }
}
