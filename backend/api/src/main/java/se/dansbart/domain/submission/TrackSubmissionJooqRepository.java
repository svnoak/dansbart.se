package se.dansbart.domain.submission;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.SelectOnConditionStep;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.noCondition;
import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.TRACK_SUBMISSIONS;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class TrackSubmissionJooqRepository {

    private final DSLContext dsl;

    public TrackSubmissionJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public TrackSubmission insert(TrackSubmission s) {
        if (s.getId() == null) s.setId(UUID.randomUUID());
        if (s.getCreatedAt() == null) s.setCreatedAt(OffsetDateTime.now());
        dsl.insertInto(TRACK_SUBMISSIONS)
            .columns(
                TRACK_SUBMISSIONS.ID, TRACK_SUBMISSIONS.BATCH_ID, TRACK_SUBMISSIONS.VOTER_ID, TRACK_SUBMISSIONS.USER_ID,
                TRACK_SUBMISSIONS.PROVIDER, TRACK_SUBMISSIONS.SOURCE_KIND, TRACK_SUBMISSIONS.SOURCE_URL, TRACK_SUBMISSIONS.SOURCE_NAME,
                TRACK_SUBMISSIONS.EXTERNAL_ID, TRACK_SUBMISSIONS.TITLE, TRACK_SUBMISSIONS.ARTIST_NAME, TRACK_SUBMISSIONS.ALBUM_NAME,
                TRACK_SUBMISSIONS.SUGGESTED_MAIN_STYLE, TRACK_SUBMISSIONS.SUGGESTED_SUB_STYLE,
                TRACK_SUBMISSIONS.STATUS, TRACK_SUBMISSIONS.TRACK_ID,
                TRACK_SUBMISSIONS.REVIEWED_BY, TRACK_SUBMISSIONS.REVIEWED_AT, TRACK_SUBMISSIONS.REVIEW_NOTE,
                TRACK_SUBMISSIONS.CREATED_AT)
            .values(
                s.getId(), s.getBatchId(), s.getVoterId(), s.getUserId(),
                s.getProvider(), s.getSourceKind(), s.getSourceUrl(), s.getSourceName(),
                s.getExternalId(), s.getTitle(), s.getArtistName(), s.getAlbumName(),
                s.getSuggestedMainStyle(), s.getSuggestedSubStyle(),
                s.getStatus(), s.getTrackId(),
                s.getReviewedBy(), s.getReviewedAt(), s.getReviewNote(),
                s.getCreatedAt())
            .execute();
        return s;
    }

    public void markReviewed(UUID id, String status, UUID trackId, UUID reviewedBy, String reviewNote,
                             String mainStyle, String subStyle) {
        dsl.update(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.STATUS, status)
            .set(TRACK_SUBMISSIONS.TRACK_ID, trackId)
            .set(TRACK_SUBMISSIONS.REVIEWED_BY, reviewedBy)
            .set(TRACK_SUBMISSIONS.REVIEWED_AT, OffsetDateTime.now())
            .set(TRACK_SUBMISSIONS.REVIEW_NOTE, reviewNote)
            .set(TRACK_SUBMISSIONS.SUGGESTED_MAIN_STYLE, mainStyle)
            .set(TRACK_SUBMISSIONS.SUGGESTED_SUB_STYLE, subStyle)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .execute();
    }

    /** Fills in the track once the ingest worker has created it. */
    public void updateTrackId(UUID id, UUID trackId) {
        dsl.update(TRACK_SUBMISSIONS)
            .set(TRACK_SUBMISSIONS.TRACK_ID, trackId)
            .where(TRACK_SUBMISSIONS.ID.eq(id))
            .execute();
    }

    public Optional<TrackSubmission> findById(UUID id) {
        return selectJoined().where(TRACK_SUBMISSIONS.ID.eq(id)).fetchOptional(this::toSubmission);
    }

    public Optional<TrackSubmission> findPendingByExternalId(String provider, String externalId) {
        return selectJoined()
            .where(TRACK_SUBMISSIONS.PROVIDER.eq(provider))
            .and(TRACK_SUBMISSIONS.EXTERNAL_ID.eq(externalId))
            .and(TRACK_SUBMISSIONS.STATUS.eq(TrackSubmission.STATUS_PENDING))
            .fetchOptional(this::toSubmission);
    }

    public List<TrackSubmission> findByBatchId(UUID batchId) {
        return selectJoined()
            .where(TRACK_SUBMISSIONS.BATCH_ID.eq(batchId))
            .orderBy(TRACK_SUBMISSIONS.CREATED_AT.asc(), TRACK_SUBMISSIONS.ID.asc())
            .fetch(this::toSubmission);
    }

    public List<TrackSubmission> findPendingByBatchId(UUID batchId) {
        return selectJoined()
            .where(TRACK_SUBMISSIONS.BATCH_ID.eq(batchId))
            .and(TRACK_SUBMISSIONS.STATUS.eq(TrackSubmission.STATUS_PENDING))
            .orderBy(TRACK_SUBMISSIONS.CREATED_AT.asc(), TRACK_SUBMISSIONS.ID.asc())
            .fetch(this::toSubmission);
    }

    public boolean existsApprovedInBatch(UUID batchId) {
        return dsl.fetchExists(
            dsl.selectOne().from(TRACK_SUBMISSIONS)
                .where(TRACK_SUBMISSIONS.BATCH_ID.eq(batchId))
                .and(TRACK_SUBMISSIONS.STATUS.eq(TrackSubmission.STATUS_APPROVED)));
    }

    /** Newest first, with the rows of one batch kept together. */
    public List<TrackSubmission> findPage(String status, int limit, int offset) {
        return selectJoined()
            .where(statusCondition(status))
            .orderBy(TRACK_SUBMISSIONS.CREATED_AT.desc(), TRACK_SUBMISSIONS.BATCH_ID.asc(), TRACK_SUBMISSIONS.ID.asc())
            .limit(limit)
            .offset(offset)
            .fetch(this::toSubmission);
    }

    public long count(String status) {
        return dsl.fetchCount(dsl.selectFrom(TRACK_SUBMISSIONS).where(statusCondition(status)));
    }

    public long countPending() {
        return count(TrackSubmission.STATUS_PENDING);
    }

    private Condition statusCondition(String status) {
        return status == null || status.isBlank() ? noCondition() : TRACK_SUBMISSIONS.STATUS.eq(status);
    }

    private SelectOnConditionStep<Record> selectJoined() {
        return dsl.select(TRACK_SUBMISSIONS.fields())
            .select(TRACKS.PROCESSING_STATUS, USERS.USERNAME)
            .from(TRACK_SUBMISSIONS)
            .leftJoin(TRACKS).on(TRACKS.ID.eq(TRACK_SUBMISSIONS.TRACK_ID))
            .leftJoin(USERS).on(USERS.ID.eq(TRACK_SUBMISSIONS.USER_ID));
    }

    private TrackSubmission toSubmission(Record r) {
        return TrackSubmission.builder()
            .id(r.get(TRACK_SUBMISSIONS.ID))
            .batchId(r.get(TRACK_SUBMISSIONS.BATCH_ID))
            .voterId(r.get(TRACK_SUBMISSIONS.VOTER_ID))
            .userId(r.get(TRACK_SUBMISSIONS.USER_ID))
            .provider(r.get(TRACK_SUBMISSIONS.PROVIDER))
            .sourceKind(r.get(TRACK_SUBMISSIONS.SOURCE_KIND))
            .sourceUrl(r.get(TRACK_SUBMISSIONS.SOURCE_URL))
            .sourceName(r.get(TRACK_SUBMISSIONS.SOURCE_NAME))
            .externalId(r.get(TRACK_SUBMISSIONS.EXTERNAL_ID))
            .title(r.get(TRACK_SUBMISSIONS.TITLE))
            .artistName(r.get(TRACK_SUBMISSIONS.ARTIST_NAME))
            .albumName(r.get(TRACK_SUBMISSIONS.ALBUM_NAME))
            .suggestedMainStyle(r.get(TRACK_SUBMISSIONS.SUGGESTED_MAIN_STYLE))
            .suggestedSubStyle(r.get(TRACK_SUBMISSIONS.SUGGESTED_SUB_STYLE))
            .status(r.get(TRACK_SUBMISSIONS.STATUS))
            .trackId(r.get(TRACK_SUBMISSIONS.TRACK_ID))
            .reviewedBy(r.get(TRACK_SUBMISSIONS.REVIEWED_BY))
            .reviewedAt(r.get(TRACK_SUBMISSIONS.REVIEWED_AT))
            .reviewNote(r.get(TRACK_SUBMISSIONS.REVIEW_NOTE))
            .createdAt(r.get(TRACK_SUBMISSIONS.CREATED_AT))
            .trackProcessingStatus(r.get(TRACKS.PROCESSING_STATUS))
            .submitterUsername(r.get(USERS.USERNAME))
            .build();
    }
}
