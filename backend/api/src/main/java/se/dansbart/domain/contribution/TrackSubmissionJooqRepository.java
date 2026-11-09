package se.dansbart.domain.contribution;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import se.dansbart.dto.AdminTrackContributionDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.TRACK_SUBMISSIONS;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class TrackSubmissionJooqRepository {

    private final DSLContext dsl;

    public TrackSubmissionJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public TrackSubmission insert(TrackSubmission s, OffsetDateTime reviewedAt) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.ID, id)
            .set(TRACK_SUBMISSIONS.USER_ID, s.userId())
            .set(TRACK_SUBMISSIONS.SOURCE, s.source())
            .set(TRACK_SUBMISSIONS.EXTERNAL_ID, s.externalId())
            .set(TRACK_SUBMISSIONS.TITLE, s.title())
            .set(TRACK_SUBMISSIONS.ARTIST_NAME, s.artistName())
            .set(TRACK_SUBMISSIONS.DANCE_STYLE, s.danceStyle())
            .set(TRACK_SUBMISSIONS.SUB_STYLE, s.subStyle())
            .set(TRACK_SUBMISSIONS.TEMPO_CATEGORY, s.tempoCategory())
            .set(TRACK_SUBMISSIONS.TRACK_ID, s.trackId())
            .set(TRACK_SUBMISSIONS.CREATED_TRACK, s.createdTrack())
            .set(TRACK_SUBMISSIONS.STATUS, s.status())
            .set(TRACK_SUBMISSIONS.REVIEWED_AT, reviewedAt)
            .execute();
        return findById(id).orElseThrow();
    }

    public Optional<TrackSubmission> findById(UUID id) {
        return dsl.selectFrom(TRACK_SUBMISSIONS)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .fetchOptional(this::toSubmission);
    }

    public List<TrackSubmission> findByStatus(String status, int limit) {
        return dsl.selectFrom(TRACK_SUBMISSIONS)
            .where(TRACK_SUBMISSIONS.STATUS.eq(status))
            .orderBy(TRACK_SUBMISSIONS.CREATED_AT.asc())
            .limit(limit)
            .fetch(this::toSubmission);
    }

    public void markLinked(UUID id, UUID trackId, boolean createdTrack) {
        dsl.update(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.TRACK_ID, trackId)
            .set(TRACK_SUBMISSIONS.CREATED_TRACK, createdTrack)
            .set(TRACK_SUBMISSIONS.STATUS, TrackSubmission.LINKED)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .execute();
    }

    public void setStatus(UUID id, String status) {
        dsl.update(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.STATUS, status)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .execute();
    }

    public long countByUserSince(UUID userId, OffsetDateTime since) {
        return dsl.fetchCount(TRACK_SUBMISSIONS,
            TRACK_SUBMISSIONS.USER_ID.eq(userId).and(TRACK_SUBMISSIONS.CREATED_AT.ge(since)));
    }

    public long countUnreviewed() {
        return dsl.fetchCount(TRACK_SUBMISSIONS, TRACK_SUBMISSIONS.REVIEWED_AT.isNull());
    }

    /** @return true if a row was updated */
    public boolean markReviewed(UUID id, UUID adminId) {
        return dsl.update(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.REVIEWED_AT, OffsetDateTime.now())
            .set(TRACK_SUBMISSIONS.REVIEWED_BY, adminId)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .execute() > 0;
    }

    public List<AdminTrackContributionDto> findUnreviewed(int limit) {
        return dsl.select(TRACK_SUBMISSIONS.asterisk(), TRACKS.TITLE, TRACKS.PROCESSING_STATUS,
                USERS.USERNAME, USERS.BANNED_AT)
            .from(TRACK_SUBMISSIONS)
            .join(USERS).on(USERS.ID.eq(TRACK_SUBMISSIONS.USER_ID))
            .leftJoin(TRACKS).on(TRACKS.ID.eq(TRACK_SUBMISSIONS.TRACK_ID))
            .where(TRACK_SUBMISSIONS.REVIEWED_AT.isNull())
            .orderBy(TRACK_SUBMISSIONS.CREATED_AT.desc())
            .limit(limit)
            .fetch(r -> new AdminTrackContributionDto(
                r.get(TRACK_SUBMISSIONS.ID),
                r.get(TRACK_SUBMISSIONS.TRACK_ID),
                r.get(TRACKS.TITLE),
                r.get(TRACK_SUBMISSIONS.SOURCE),
                r.get(TRACK_SUBMISSIONS.EXTERNAL_ID),
                r.get(TRACK_SUBMISSIONS.TITLE),
                r.get(TRACK_SUBMISSIONS.ARTIST_NAME),
                r.get(TRACK_SUBMISSIONS.DANCE_STYLE),
                r.get(TRACK_SUBMISSIONS.SUB_STYLE),
                r.get(TRACK_SUBMISSIONS.TEMPO_CATEGORY),
                r.get(TRACK_SUBMISSIONS.STATUS),
                Boolean.TRUE.equals(r.get(TRACK_SUBMISSIONS.CREATED_TRACK)),
                r.get(TRACKS.PROCESSING_STATUS),
                r.get(TRACK_SUBMISSIONS.USER_ID),
                r.get(USERS.USERNAME),
                r.get(USERS.BANNED_AT) != null,
                r.get(TRACK_SUBMISSIONS.CREATED_AT)));
    }

    private TrackSubmission toSubmission(Record r) {
        return new TrackSubmission(
            r.get(TRACK_SUBMISSIONS.ID),
            r.get(TRACK_SUBMISSIONS.USER_ID),
            r.get(TRACK_SUBMISSIONS.SOURCE),
            r.get(TRACK_SUBMISSIONS.EXTERNAL_ID),
            r.get(TRACK_SUBMISSIONS.TITLE),
            r.get(TRACK_SUBMISSIONS.ARTIST_NAME),
            r.get(TRACK_SUBMISSIONS.DANCE_STYLE),
            r.get(TRACK_SUBMISSIONS.SUB_STYLE),
            r.get(TRACK_SUBMISSIONS.TEMPO_CATEGORY),
            r.get(TRACK_SUBMISSIONS.TRACK_ID),
            Boolean.TRUE.equals(r.get(TRACK_SUBMISSIONS.CREATED_TRACK)),
            r.get(TRACK_SUBMISSIONS.STATUS),
            r.get(TRACK_SUBMISSIONS.REVIEWED_AT),
            r.get(TRACK_SUBMISSIONS.CREATED_AT));
    }
}
