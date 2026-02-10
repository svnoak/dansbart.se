package se.dansbart.domain.track;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.io.UncheckedIOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.TRACK_STRUCTURE_VERSIONS;

@Repository
public class TrackStructureVersionJooqRepository {

    private final DSLContext dsl;
    private final ObjectMapper objectMapper;

    public TrackStructureVersionJooqRepository(DSLContext dsl, ObjectMapper objectMapper) {
        this.dsl = dsl;
        this.objectMapper = objectMapper;
    }

    public Optional<TrackStructureVersion> findById(UUID id) {
        return dsl.selectFrom(TRACK_STRUCTURE_VERSIONS)
            .where(TRACK_STRUCTURE_VERSIONS.ID.eq(id))
            .fetchOptional(this::toVersion);
    }

    public List<TrackStructureVersion> findByTrackIdOrderByActiveAndVotes(UUID trackId) {
        return dsl.selectFrom(TRACK_STRUCTURE_VERSIONS)
            .where(TRACK_STRUCTURE_VERSIONS.TRACK_ID.eq(trackId)
                .and(TRACK_STRUCTURE_VERSIONS.IS_HIDDEN.eq(false)))
            .orderBy(
                TRACK_STRUCTURE_VERSIONS.IS_ACTIVE.desc(),
                TRACK_STRUCTURE_VERSIONS.VOTE_COUNT.desc(),
                TRACK_STRUCTURE_VERSIONS.CREATED_AT.desc()
            )
            .fetch(this::toVersion);
    }

    public Optional<TrackStructureVersion> findByTrackIdAndIsActiveTrue(UUID trackId) {
        return dsl.selectFrom(TRACK_STRUCTURE_VERSIONS)
            .where(TRACK_STRUCTURE_VERSIONS.TRACK_ID.eq(trackId)
                .and(TRACK_STRUCTURE_VERSIONS.IS_ACTIVE.eq(true)))
            .fetchOptional(this::toVersion);
    }

    public void updateVoteCount(UUID id, int delta) {
        dsl.update(TRACK_STRUCTURE_VERSIONS)
            .set(TRACK_STRUCTURE_VERSIONS.VOTE_COUNT, TRACK_STRUCTURE_VERSIONS.VOTE_COUNT.plus(delta))
            .where(TRACK_STRUCTURE_VERSIONS.ID.eq(id))
            .execute();
    }

    public void incrementReportCount(UUID id) {
        dsl.update(TRACK_STRUCTURE_VERSIONS)
            .set(TRACK_STRUCTURE_VERSIONS.REPORT_COUNT, TRACK_STRUCTURE_VERSIONS.REPORT_COUNT.plus(1))
            .where(TRACK_STRUCTURE_VERSIONS.ID.eq(id))
            .execute();
    }

    public void deactivateAllForTrack(UUID trackId) {
        dsl.update(TRACK_STRUCTURE_VERSIONS)
            .set(TRACK_STRUCTURE_VERSIONS.IS_ACTIVE, false)
            .where(TRACK_STRUCTURE_VERSIONS.TRACK_ID.eq(trackId))
            .execute();
    }

    public List<TrackStructureVersion> findAll() {
        return dsl.selectFrom(TRACK_STRUCTURE_VERSIONS)
            .fetch(this::toVersion);
    }

    public long count() {
        return dsl.fetchCount(TRACK_STRUCTURE_VERSIONS);
    }

    public TrackStructureVersion save(TrackStructureVersion version) {
        JSONB json;
        try {
            json = JSONB.jsonb(objectMapper.writeValueAsString(version.getStructureData()));
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }

        if (version.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(TRACK_STRUCTURE_VERSIONS)
                .columns(
                    TRACK_STRUCTURE_VERSIONS.ID,
                    TRACK_STRUCTURE_VERSIONS.TRACK_ID,
                    TRACK_STRUCTURE_VERSIONS.DESCRIPTION,
                    TRACK_STRUCTURE_VERSIONS.STRUCTURE_DATA,
                    TRACK_STRUCTURE_VERSIONS.VOTE_COUNT,
                    TRACK_STRUCTURE_VERSIONS.REPORT_COUNT,
                    TRACK_STRUCTURE_VERSIONS.IS_ACTIVE,
                    TRACK_STRUCTURE_VERSIONS.IS_HIDDEN,
                    TRACK_STRUCTURE_VERSIONS.AUTHOR_ALIAS
                )
                .values(
                    id,
                    version.getTrackId(),
                    version.getDescription(),
                    json,
                    version.getVoteCount(),
                    version.getReportCount(),
                    version.getIsActive(),
                    version.getIsHidden(),
                    version.getAuthorAlias()
                )
                .execute();
            version.setId(id);
        } else {
            dsl.update(TRACK_STRUCTURE_VERSIONS)
                .set(TRACK_STRUCTURE_VERSIONS.DESCRIPTION, version.getDescription())
                .set(TRACK_STRUCTURE_VERSIONS.STRUCTURE_DATA, json)
                .set(TRACK_STRUCTURE_VERSIONS.VOTE_COUNT, version.getVoteCount())
                .set(TRACK_STRUCTURE_VERSIONS.REPORT_COUNT, version.getReportCount())
                .set(TRACK_STRUCTURE_VERSIONS.IS_ACTIVE, version.getIsActive())
                .set(TRACK_STRUCTURE_VERSIONS.IS_HIDDEN, version.getIsHidden())
                .set(TRACK_STRUCTURE_VERSIONS.AUTHOR_ALIAS, version.getAuthorAlias())
                .where(TRACK_STRUCTURE_VERSIONS.ID.eq(version.getId()))
                .execute();
        }
        return version;
    }

    private TrackStructureVersion toVersion(Record r) {
        TrackStructureVersion v = new TrackStructureVersion();
        v.setId(r.get(TRACK_STRUCTURE_VERSIONS.ID));
        v.setTrackId(r.get(TRACK_STRUCTURE_VERSIONS.TRACK_ID));
        v.setCreatedAt(r.get(TRACK_STRUCTURE_VERSIONS.CREATED_AT));
        v.setDescription(r.get(TRACK_STRUCTURE_VERSIONS.DESCRIPTION));
        JSONB json = r.get(TRACK_STRUCTURE_VERSIONS.STRUCTURE_DATA);
        if (json != null) {
            try {
                @SuppressWarnings("unchecked")
                var map = objectMapper.readValue(json.data(), java.util.Map.class);
                v.setStructureData(map);
            } catch (Exception e) {
                // On parse failure, leave structureData null rather than failing the query
                v.setStructureData(null);
            }
        }
        v.setVoteCount(r.get(TRACK_STRUCTURE_VERSIONS.VOTE_COUNT));
        v.setReportCount(r.get(TRACK_STRUCTURE_VERSIONS.REPORT_COUNT));
        v.setIsActive(r.get(TRACK_STRUCTURE_VERSIONS.IS_ACTIVE));
        v.setIsHidden(r.get(TRACK_STRUCTURE_VERSIONS.IS_HIDDEN));
        v.setAuthorAlias(r.get(TRACK_STRUCTURE_VERSIONS.AUTHOR_ALIAS));
        return v;
    }
}

