package se.dansbart.domain.providerconnection;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Component
public class ProviderTokenRefreshJob {

    private static final Duration EXPIRY_WINDOW = Duration.ofDays(14);
    private static final Duration STALE_THRESHOLD = Duration.ofDays(30);

    private final ProviderConnectionJooqRepository repository;
    private final ProviderConnectionService service;
    private final Clock clock;

    public ProviderTokenRefreshJob(
            ProviderConnectionJooqRepository repository,
            ProviderConnectionService service,
            Clock clock) {
        this.repository = repository;
        this.service = service;
        this.clock = clock;
    }

    @Scheduled(cron = "${dansbart.tokens.refresh-cron:0 30 3 * * *}", zone = "UTC")
    public void refreshDueConnections() {
        Instant now = clock.instant();
        Instant expiryCutoff = now.plus(EXPIRY_WINDOW);
        Instant staleBefore = now.minus(STALE_THRESHOLD);

        List<ProviderConnection> dueConnections = repository.findActiveDueForRefresh(expiryCutoff, staleBefore);

        for (ProviderConnection connection : dueConnections) {
            try {
                service.refreshConnection(connection);
            } catch (RuntimeException e) {
                log.warn("Token refresh failed for connection {}: {}", connection.id(), e.getClass().getSimpleName());
            }
        }
    }
}
