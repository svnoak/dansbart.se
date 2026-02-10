package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.REJECTION_LOGS;

@Repository
public class RejectionLogJooqRepository {

    private final DSLContext dsl;

    public RejectionLogJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<RejectionLog> findById(UUID id) {
        return dsl.selectFrom(REJECTION_LOGS).where(REJECTION_LOGS.ID.eq(id)).fetchOptional(this::toRejectionLog);
    }

    public Page<RejectionLog> findAllByOrderByRejectedAtDesc(Pageable pageable) {
        long total = dsl.fetchCount(REJECTION_LOGS);
        List<RejectionLog> content = dsl.selectFrom(REJECTION_LOGS)
            .orderBy(REJECTION_LOGS.REJECTED_AT.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toRejectionLog);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<RejectionLog> findByEntityTypeOrderByRejectedAtDesc(String entityType, Pageable pageable) {
        long total = dsl.fetchCount(dsl.selectFrom(REJECTION_LOGS).where(REJECTION_LOGS.ENTITY_TYPE.eq(entityType)));
        List<RejectionLog> content = dsl.selectFrom(REJECTION_LOGS)
            .where(REJECTION_LOGS.ENTITY_TYPE.eq(entityType))
            .orderBy(REJECTION_LOGS.REJECTED_AT.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toRejectionLog);
        return new PageImpl<>(content, pageable, total);
    }

    public boolean existsBySpotifyIdAndEntityType(String spotifyId, String entityType) {
        return dsl.fetchExists(dsl.selectFrom(REJECTION_LOGS).where(REJECTION_LOGS.SPOTIFY_ID.eq(spotifyId).and(REJECTION_LOGS.ENTITY_TYPE.eq(entityType))));
    }

    public RejectionLog insert(RejectionLog log) {
        var id = log.getId() != null ? log.getId() : UUID.randomUUID();
        dsl.insertInto(REJECTION_LOGS)
            .columns(REJECTION_LOGS.ID, REJECTION_LOGS.ENTITY_TYPE, REJECTION_LOGS.SPOTIFY_ID,
                REJECTION_LOGS.ENTITY_NAME, REJECTION_LOGS.REASON, REJECTION_LOGS.DELETED_CONTENT)
            .values(id, log.getEntityType(), log.getSpotifyId(), log.getEntityName(),
                log.getReason(), log.getDeletedContent() != null ? log.getDeletedContent() : true)
            // Ensure idempotency when the same (spotify_id, entity_type) is rejected again
            .onConflict(REJECTION_LOGS.SPOTIFY_ID, REJECTION_LOGS.ENTITY_TYPE)
            .doUpdate()
            .set(REJECTION_LOGS.ENTITY_NAME, log.getEntityName())
            .set(REJECTION_LOGS.REASON, log.getReason())
            .set(REJECTION_LOGS.DELETED_CONTENT, log.getDeletedContent() != null ? log.getDeletedContent() : true)
            .execute();
        log.setId(id);
        return log;
    }

    public void deleteById(UUID id) {
        dsl.deleteFrom(REJECTION_LOGS).where(REJECTION_LOGS.ID.eq(id)).execute();
    }

    public void deleteAll() {
        dsl.deleteFrom(REJECTION_LOGS).execute();
    }

    public long count() {
        return dsl.fetchCount(REJECTION_LOGS);
    }

    public void delete(RejectionLog log) {
        if (log != null && log.getId() != null) {
            deleteById(log.getId());
        }
    }

    private RejectionLog toRejectionLog(Record r) {
        RejectionLog log = new RejectionLog();
        log.setId(r.get(REJECTION_LOGS.ID));
        log.setEntityType(r.get(REJECTION_LOGS.ENTITY_TYPE));
        log.setSpotifyId(r.get(REJECTION_LOGS.SPOTIFY_ID));
        log.setEntityName(r.get(REJECTION_LOGS.ENTITY_NAME));
        log.setReason(r.get(REJECTION_LOGS.REASON));
        log.setRejectedAt(r.get(REJECTION_LOGS.REJECTED_AT));
        log.setDeletedContent(r.get(REJECTION_LOGS.DELETED_CONTENT) != null && r.get(REJECTION_LOGS.DELETED_CONTENT));
        // additionalData (JSONB) left null for now
        return log;
    }
}
