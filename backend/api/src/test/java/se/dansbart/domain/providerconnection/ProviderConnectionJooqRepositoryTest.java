package se.dansbart.domain.providerconnection;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.jooq.exception.IntegrityConstraintViolationException;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;
import se.dansbart.repository.AbstractRepositoryTest;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProviderConnectionJooqRepositoryTest extends AbstractRepositoryTest {

    private static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.MICROS);

    @Autowired
    private ProviderConnectionJooqRepository repository;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private TestDataFactory testData;

    private ProviderConnection connection(User user, String provider, Instant expiresAt, Instant lastRefreshedAt) {
        return new ProviderConnection(
            UUID.randomUUID(), user.getId(), provider, "ACTIVE",
            new byte[] {1, 2, 3}, expiresAt, lastRefreshedAt);
    }

    @Test
    void insertsAndFindsAConnection() {
        User user = testData.user().withUsername("owner").build();
        Instant expiresAt = NOW.plus(30, ChronoUnit.DAYS);
        ProviderConnection connection = new ProviderConnection(
            UUID.randomUUID(), user.getId(), "GDRIVE", "ACTIVE",
            new byte[] {9, 8, 7, 0, -1}, expiresAt, NOW);

        repository.insert(connection);

        ProviderConnection found = repository.findById(connection.id()).orElseThrow();
        assertThat(found.userId()).isEqualTo(user.getId());
        assertThat(found.provider()).isEqualTo("GDRIVE");
        assertThat(found.status()).isEqualTo("ACTIVE");
        assertThat(found.encryptedRefreshToken()).containsExactly(9, 8, 7, 0, -1);
        assertThat(found.refreshTokenExpiresAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(expiresAt);
        assertThat(found.lastRefreshedAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(NOW);
    }

    @Test
    void rejectsASecondConnectionForTheSameUserAndProvider() {
        User user = testData.user().withUsername("owner").build();
        repository.insert(connection(user, "HIDRIVE", null, NOW));

        assertThatThrownBy(() -> repository.insert(connection(user, "HIDRIVE", null, NOW)))
            .isInstanceOf(IntegrityConstraintViolationException.class);
    }

    @Test
    void findsConnectionsDueForRefresh() {
        Instant cutoff = NOW.plus(7, ChronoUnit.DAYS);
        Instant staleBefore = NOW.minus(30, ChronoUnit.DAYS);
        User userA = testData.user().withUsername("a").build();
        User userB = testData.user().withUsername("b").build();
        User userC = testData.user().withUsername("c").build();
        User userD = testData.user().withUsername("d").build();
        User userE = testData.user().withUsername("e").build();

        ProviderConnection dueByExpiry = connection(userA, "GDRIVE", NOW.plus(1, ChronoUnit.DAYS), NOW);
        ProviderConnection notDueByExpiry = connection(userB, "GDRIVE", NOW.plus(20, ChronoUnit.DAYS), NOW);
        ProviderConnection dueByAge = connection(userC, "GDRIVE", null, NOW.minus(60, ChronoUnit.DAYS));
        ProviderConnection notDueByAge = connection(userD, "GDRIVE", null, NOW.minus(1, ChronoUnit.DAYS));
        ProviderConnection needsReconnect = connection(userE, "GDRIVE", NOW.plus(1, ChronoUnit.DAYS), NOW);
        for (ProviderConnection c : List.of(dueByExpiry, notDueByExpiry, dueByAge, notDueByAge, needsReconnect)) {
            repository.insert(c);
        }
        repository.markNeedsReconnect(needsReconnect.id(), new byte[] {1, 2, 3});

        List<ProviderConnection> due = repository.findActiveDueForRefresh(cutoff, staleBefore);

        assertThat(due).extracting(ProviderConnection::id)
            .containsExactlyInAnyOrder(dueByExpiry.id(), dueByAge.id());
    }

    @Test
    void updatesTheTokenAndRefreshTimes() {
        User user = testData.user().withUsername("owner").build();
        ProviderConnection connection = connection(user, "GDRIVE", null, NOW.minus(10, ChronoUnit.DAYS));
        repository.insert(connection);
        Instant newExpiry = NOW.plus(90, ChronoUnit.DAYS);

        assertThat(repository.updateToken(connection.id(), new byte[] {1, 2, 3}, new byte[] {4, 5, 6}, newExpiry, NOW)).isTrue();

        ProviderConnection found = repository.findById(connection.id()).orElseThrow();
        assertThat(found.encryptedRefreshToken()).containsExactly(4, 5, 6);
        assertThat(found.refreshTokenExpiresAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(newExpiry);
        assertThat(found.lastRefreshedAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(NOW);
    }

    @Test
    void updateTokenSkipsWhenTheTokenChanged() {
        User user = testData.user().withUsername("owner").build();
        ProviderConnection connection = connection(user, "GDRIVE", null, NOW.minus(10, ChronoUnit.DAYS));
        repository.insert(connection);

        boolean updated = repository.updateToken(
            connection.id(), new byte[] {9, 9}, new byte[] {4, 5, 6}, NOW.plus(90, ChronoUnit.DAYS), NOW);

        assertThat(updated).isFalse();
        assertThat(repository.findById(connection.id()).orElseThrow().encryptedRefreshToken())
            .containsExactly(1, 2, 3);
    }

    @Test
    void updateTokenKeepsTheKnownExpiryWhenNoneIsGiven() {
        User user = testData.user().withUsername("owner").build();
        Instant expiresAt = NOW.plus(30, ChronoUnit.DAYS);
        ProviderConnection connection = connection(user, "GDRIVE", expiresAt, NOW.minus(10, ChronoUnit.DAYS));
        repository.insert(connection);

        repository.updateToken(connection.id(), new byte[] {1, 2, 3}, new byte[] {4, 5, 6}, null, NOW);

        ProviderConnection found = repository.findById(connection.id()).orElseThrow();
        assertThat(found.refreshTokenExpiresAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(expiresAt);
    }

    @Test
    void markNeedsReconnectSkipsWhenTheTokenChanged() {
        User user = testData.user().withUsername("owner").build();
        ProviderConnection connection = connection(user, "GDRIVE", null, NOW);
        repository.insert(connection);

        assertThat(repository.markNeedsReconnect(connection.id(), new byte[] {9, 9})).isFalse();

        assertThat(repository.findById(connection.id()).orElseThrow().status()).isEqualTo("ACTIVE");
    }

    @Test
    void marksAConnectionForReconnect() {
        User user = testData.user().withUsername("owner").build();
        ProviderConnection connection = connection(user, "GDRIVE", null, NOW);
        repository.insert(connection);

        assertThat(repository.markNeedsReconnect(connection.id(), new byte[] {1, 2, 3})).isTrue();

        assertThat(repository.findById(connection.id()).orElseThrow().status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void deletingAConnectionClearsTheTrackSourceLink() {
        User user = testData.user().withUsername("owner").build();
        Track track = testData.track().withTitle("Polska").build();
        ProviderConnection connection = connection(user, "GDRIVE", null, NOW);
        repository.insert(connection);
        UUID sourceId = UUID.randomUUID();
        dsl.execute(
            "insert into user_track_sources (id, user_id, track_id, provider, provider_file_id, connection_id, title) "
                + "values (?, ?, ?, 'GDRIVE', 'file-1', ?, 'Polska')",
            sourceId, user.getId(), track.getId(), connection.id());

        dsl.execute("delete from provider_connections where id = ?", connection.id());

        assertThat(dsl.fetchOne("select count(*) from user_track_sources where id = ?", sourceId).get(0, Integer.class))
            .isEqualTo(1);
        assertThat(dsl.fetchOne("select connection_id from user_track_sources where id = ?", sourceId).get(0))
            .isNull();
    }

    @Test
    void findsAConnectionByUserAndProvider() {
        User user1 = testData.user().withUsername("user1").build();
        User user2 = testData.user().withUsername("user2").build();
        ProviderConnection conn1 = connection(user1, "GDRIVE", null, NOW);
        ProviderConnection conn2 = connection(user1, "HIDRIVE", null, NOW);
        ProviderConnection conn3 = connection(user2, "GDRIVE", null, NOW);
        repository.insert(conn1);
        repository.insert(conn2);
        repository.insert(conn3);

        ProviderConnection found1 = repository.findByUserAndProvider(user1.getId(), "GDRIVE").orElseThrow();
        assertThat(found1.id()).isEqualTo(conn1.id());
        assertThat(found1.userId()).isEqualTo(user1.getId());
        assertThat(found1.provider()).isEqualTo("GDRIVE");
        assertThat(found1.status()).isEqualTo("ACTIVE");
        assertThat(found1.encryptedRefreshToken()).containsExactly(1, 2, 3);

        ProviderConnection found2 = repository.findByUserAndProvider(user1.getId(), "HIDRIVE").orElseThrow();
        assertThat(found2.id()).isEqualTo(conn2.id());
        assertThat(found2.provider()).isEqualTo("HIDRIVE");

        ProviderConnection found3 = repository.findByUserAndProvider(user2.getId(), "GDRIVE").orElseThrow();
        assertThat(found3.id()).isEqualTo(conn3.id());
        assertThat(found3.userId()).isEqualTo(user2.getId());

        assertThat(repository.findByUserAndProvider(user2.getId(), "HIDRIVE"))
            .isEmpty();
        assertThat(repository.findByUserAndProvider(user1.getId(), "UNKNOWN"))
            .isEmpty();
    }

    @Test
    void replacesTheTokenOnTheSameRowAndReactivatesIt() {
        User user = testData.user().withUsername("owner").build();
        Instant expiresAt = NOW.plus(30, ChronoUnit.DAYS);
        ProviderConnection connection = new ProviderConnection(
            UUID.randomUUID(), user.getId(), "GDRIVE", "NEEDS_RECONNECT",
            new byte[] {1, 2, 3}, expiresAt, NOW);
        repository.insert(connection);
        byte[] newToken = new byte[] {4, 5, 6};
        Instant newLastRefreshedAt = NOW.plus(1, ChronoUnit.DAYS);

        repository.replaceToken(connection.id(), newToken, null, newLastRefreshedAt);

        ProviderConnection found = repository.findById(connection.id()).orElseThrow();
        assertThat(found.id()).isEqualTo(connection.id());
        assertThat(found.status()).isEqualTo("ACTIVE");
        assertThat(found.encryptedRefreshToken()).containsExactly(4, 5, 6);
        assertThat(found.refreshTokenExpiresAt()).isNull();
        assertThat(found.lastRefreshedAt().truncatedTo(ChronoUnit.MICROS)).isEqualTo(newLastRefreshedAt);
    }
}
