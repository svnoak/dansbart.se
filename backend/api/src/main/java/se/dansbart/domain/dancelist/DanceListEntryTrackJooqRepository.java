package se.dansbart.domain.dancelist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_LIST_ENTRY_TRACKS;

@Repository
public class DanceListEntryTrackJooqRepository {

    private final DSLContext dsl;

    public DanceListEntryTrackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceListEntryTrack> findById(UUID id) {
        return dsl.selectFrom(DANCE_LIST_ENTRY_TRACKS).where(DANCE_LIST_ENTRY_TRACKS.ID.eq(id)).fetchOptional(this::toDanceListEntryTrack);
    }

    public List<DanceListEntryTrack> findByEntryIdOrderByPosition(UUID entryId) {
        return dsl.selectFrom(DANCE_LIST_ENTRY_TRACKS)
            .where(DANCE_LIST_ENTRY_TRACKS.ENTRY_ID.eq(entryId))
            .orderBy(DANCE_LIST_ENTRY_TRACKS.POSITION.asc())
            .fetch(this::toDanceListEntryTrack);
    }

    public DanceListEntryTrack insert(DanceListEntryTrack link) {
        UUID id = link.getId() != null ? link.getId() : UUID.randomUUID();
        dsl.insertInto(DANCE_LIST_ENTRY_TRACKS)
            .columns(DANCE_LIST_ENTRY_TRACKS.ID, DANCE_LIST_ENTRY_TRACKS.ENTRY_ID, DANCE_LIST_ENTRY_TRACKS.TRACK_ID, DANCE_LIST_ENTRY_TRACKS.POSITION, DANCE_LIST_ENTRY_TRACKS.VOTER_ID, DANCE_LIST_ENTRY_TRACKS.VOTE_CAST)
            .values(id, link.getEntryId(), link.getTrackId(), link.getPosition(), link.getVoterId(), link.getVoteCast())
            .execute();
        link.setId(id);
        return link;
    }

    private DanceListEntryTrack toDanceListEntryTrack(Record r) {
        return DanceListEntryTrack.builder()
            .id(r.get(DANCE_LIST_ENTRY_TRACKS.ID))
            .entryId(r.get(DANCE_LIST_ENTRY_TRACKS.ENTRY_ID))
            .trackId(r.get(DANCE_LIST_ENTRY_TRACKS.TRACK_ID))
            .position(r.get(DANCE_LIST_ENTRY_TRACKS.POSITION))
            .voterId(r.get(DANCE_LIST_ENTRY_TRACKS.VOTER_ID))
            .voteCast(Boolean.TRUE.equals(r.get(DANCE_LIST_ENTRY_TRACKS.VOTE_CAST)))
            .createdAt(r.get(DANCE_LIST_ENTRY_TRACKS.CREATED_AT))
            .build();
    }
}
