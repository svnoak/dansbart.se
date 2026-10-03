package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ProviderTokenRefreshJobTest {

    private static final Instant NOW = Instant.parse("2026-03-15T12:00:00Z");

    @Mock
    private ProviderConnectionJooqRepository repository;

    @Mock
    private ProviderConnectionService service;

    private Clock clock;
    private ProviderTokenRefreshJob job;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(NOW, ZoneOffset.UTC);
        job = new ProviderTokenRefreshJob(repository, service, clock);
    }

    @Test
    void asksForConnectionsExpiringWithinFourteenDaysOrNotRefreshedForThirtyDays() {
        job.refreshDueConnections();

        Instant expectedExpiryCutoff = NOW.plus(java.time.Duration.ofDays(14));
        Instant expectedStaleBefore = NOW.minus(java.time.Duration.ofDays(30));

        verify(repository).findActiveDueForRefresh(expectedExpiryCutoff, expectedStaleBefore);
    }

    @Test
    void refreshesEachDueConnection() {
        ProviderConnection connection1 = createConnection();
        ProviderConnection connection2 = createConnection();
        List<ProviderConnection> dueConnections = List.of(connection1, connection2);

        org.mockito.Mockito.when(repository.findActiveDueForRefresh(any(), any()))
            .thenReturn(dueConnections);

        job.refreshDueConnections();

        verify(service).refreshConnection(connection1);
        verify(service).refreshConnection(connection2);
    }

    @Test
    void keepsGoingWhenOneConnectionFails() {
        ProviderConnection failingConnection = createConnection();
        ProviderConnection successConnection = createConnection();
        List<ProviderConnection> dueConnections = List.of(failingConnection, successConnection);

        org.mockito.Mockito.when(repository.findActiveDueForRefresh(any(), any()))
            .thenReturn(dueConnections);
        doThrow(new RuntimeException("provider unavailable"))
            .when(service).refreshConnection(failingConnection);

        assertThatCode(() -> job.refreshDueConnections())
            .doesNotThrowAnyException();

        verify(service).refreshConnection(failingConnection);
        verify(service).refreshConnection(successConnection);
    }

    @Test
    void runsDailyAtHalfPastThreeUtc() throws NoSuchMethodException {
        var method = ProviderTokenRefreshJob.class.getMethod("refreshDueConnections");
        var scheduled = method.getAnnotation(Scheduled.class);

        assertThat(scheduled).isNotNull();
        assertThat(scheduled.cron()).isEqualTo("${dansbart.tokens.refresh-cron:0 30 3 * * *}");
        assertThat(scheduled.zone()).isEqualTo("UTC");
    }

    private ProviderConnection createConnection() {
        return new ProviderConnection(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "GDRIVE",
            "ACTIVE",
            new byte[]{},
            NOW.plusSeconds(3600),
            NOW
        );
    }
}
