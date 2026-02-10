package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.PENDING_ARTIST_APPROVALS;

@Repository
public class PendingArtistApprovalJooqRepository {

    private final DSLContext dsl;

    public PendingArtistApprovalJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<PendingArtistApproval> findById(UUID id) {
        return dsl.selectFrom(PENDING_ARTIST_APPROVALS)
            .where(PENDING_ARTIST_APPROVALS.ID.eq(id))
            .fetchOptional(this::toPending);
    }

    public Page<PendingArtistApproval> findByStatusOrderByDiscoveredAtDesc(String status, Pageable pageable) {
        var condition = PENDING_ARTIST_APPROVALS.STATUS.eq(status);
        long total = dsl.fetchCount(dsl.selectFrom(PENDING_ARTIST_APPROVALS).where(condition));
        List<PendingArtistApproval> content = dsl.selectFrom(PENDING_ARTIST_APPROVALS)
            .where(condition)
            .orderBy(PENDING_ARTIST_APPROVALS.DISCOVERED_AT.desc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toPending);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<PendingArtistApproval> searchByNameAndStatus(String search, String status, Pageable pageable) {
        var condition = PENDING_ARTIST_APPROVALS.STATUS.eq(status)
            .and(PENDING_ARTIST_APPROVALS.NAME.lower().like("%" + search.toLowerCase() + "%"));
        long total = dsl.fetchCount(dsl.selectFrom(PENDING_ARTIST_APPROVALS).where(condition));
        List<PendingArtistApproval> content = dsl.selectFrom(PENDING_ARTIST_APPROVALS)
            .where(condition)
            .orderBy(PENDING_ARTIST_APPROVALS.DISCOVERED_AT.desc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toPending);
        return new PageImpl<>(content, pageable, total);
    }

    public PendingArtistApproval save(PendingArtistApproval pending) {
        if (pending.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(PENDING_ARTIST_APPROVALS)
                .columns(
                    PENDING_ARTIST_APPROVALS.ID,
                    PENDING_ARTIST_APPROVALS.SPOTIFY_ID,
                    PENDING_ARTIST_APPROVALS.NAME,
                    PENDING_ARTIST_APPROVALS.IMAGE_URL,
                    PENDING_ARTIST_APPROVALS.DISCOVERY_SOURCE,
                    PENDING_ARTIST_APPROVALS.STATUS,
                    PENDING_ARTIST_APPROVALS.REVIEWED_AT
                )
                .values(
                    id,
                    pending.getSpotifyId(),
                    pending.getName(),
                    pending.getImageUrl(),
                    pending.getDiscoverySource(),
                    pending.getStatus(),
                    pending.getReviewedAt()
                )
                .execute();
            pending.setId(id);
        } else {
            dsl.update(PENDING_ARTIST_APPROVALS)
                .set(PENDING_ARTIST_APPROVALS.STATUS, pending.getStatus())
                .set(PENDING_ARTIST_APPROVALS.REVIEWED_AT, pending.getReviewedAt())
                .where(PENDING_ARTIST_APPROVALS.ID.eq(pending.getId()))
                .execute();
        }
        return pending;
    }

    private PendingArtistApproval toPending(Record r) {
        PendingArtistApproval p = new PendingArtistApproval();
        p.setId(r.get(PENDING_ARTIST_APPROVALS.ID));
        p.setSpotifyId(r.get(PENDING_ARTIST_APPROVALS.SPOTIFY_ID));
        p.setName(r.get(PENDING_ARTIST_APPROVALS.NAME));
        p.setImageUrl(r.get(PENDING_ARTIST_APPROVALS.IMAGE_URL));
        p.setDiscoveredAt(r.get(PENDING_ARTIST_APPROVALS.DISCOVERED_AT));
        p.setDiscoverySource(r.get(PENDING_ARTIST_APPROVALS.DISCOVERY_SOURCE));
        // detectedGenres and additionalData (JSONB) left null here
        p.setMusicGenreClassification(r.get(PENDING_ARTIST_APPROVALS.MUSIC_GENRE_CLASSIFICATION));
        Double conf = r.get(PENDING_ARTIST_APPROVALS.GENRE_CONFIDENCE);
        p.setGenreConfidence(conf != null ? conf.floatValue() : null);
        p.setStatus(r.get(PENDING_ARTIST_APPROVALS.STATUS));
        p.setReviewedAt(r.get(PENDING_ARTIST_APPROVALS.REVIEWED_AT));
        return p;
    }
}

