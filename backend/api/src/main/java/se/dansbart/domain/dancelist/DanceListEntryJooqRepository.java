package se.dansbart.domain.dancelist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_LIST_ENTRIES;

@Repository
public class DanceListEntryJooqRepository {

    private final DSLContext dsl;

    public DanceListEntryJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceListEntry> findById(UUID id) {
        return dsl.selectFrom(DANCE_LIST_ENTRIES).where(DANCE_LIST_ENTRIES.ID.eq(id)).fetchOptional(this::toDanceListEntry);
    }

    public List<DanceListEntry> findByDanceListIdOrderByPosition(UUID danceListId) {
        return dsl.selectFrom(DANCE_LIST_ENTRIES)
            .where(DANCE_LIST_ENTRIES.DANCE_LIST_ID.eq(danceListId))
            .orderBy(DANCE_LIST_ENTRIES.POSITION.asc())
            .fetch(this::toDanceListEntry);
    }

    public boolean existsByDanceListIdAndDanceId(UUID danceListId, UUID danceId) {
        return dsl.fetchExists(
            dsl.selectOne().from(DANCE_LIST_ENTRIES)
                .where(DANCE_LIST_ENTRIES.DANCE_LIST_ID.eq(danceListId))
                .and(DANCE_LIST_ENTRIES.DANCE_ID.eq(danceId))
        );
    }

    public int count(UUID danceListId) {
        return dsl.fetchCount(dsl.selectFrom(DANCE_LIST_ENTRIES).where(DANCE_LIST_ENTRIES.DANCE_LIST_ID.eq(danceListId)));
    }

    public DanceListEntry insert(DanceListEntry entry) {
        UUID id = entry.getId() != null ? entry.getId() : UUID.randomUUID();
        var step = dsl.insertInto(DANCE_LIST_ENTRIES)
            .set(DANCE_LIST_ENTRIES.ID, id)
            .set(DANCE_LIST_ENTRIES.DANCE_LIST_ID, entry.getDanceListId())
            .set(DANCE_LIST_ENTRIES.DANCE_ID, entry.getDanceId())
            .set(DANCE_LIST_ENTRIES.FREE_TEXT_NAME, entry.getFreeTextName())
            .set(DANCE_LIST_ENTRIES.SUGGESTION_ID, entry.getSuggestionId())
            .set(DANCE_LIST_ENTRIES.POSITION, entry.getPosition());
        if (entry.getPlayMode() != null) {
            step.set(DANCE_LIST_ENTRIES.PLAY_MODE, entry.getPlayMode());
        }
        step.execute();
        entry.setId(id);
        if (entry.getPlayMode() == null) {
            entry.setPlayMode(findById(id).map(DanceListEntry::getPlayMode).orElse(null));
        }
        return entry;
    }

    public void updatePosition(UUID entryId, int position) {
        dsl.update(DANCE_LIST_ENTRIES).set(DANCE_LIST_ENTRIES.POSITION, position).where(DANCE_LIST_ENTRIES.ID.eq(entryId)).execute();
    }

    public void updatePlayMode(UUID entryId, String playMode) {
        dsl.update(DANCE_LIST_ENTRIES).set(DANCE_LIST_ENTRIES.PLAY_MODE, playMode).where(DANCE_LIST_ENTRIES.ID.eq(entryId)).execute();
    }

    public void delete(UUID entryId) {
        dsl.deleteFrom(DANCE_LIST_ENTRIES).where(DANCE_LIST_ENTRIES.ID.eq(entryId)).execute();
    }

    private DanceListEntry toDanceListEntry(Record r) {
        return DanceListEntry.builder()
            .id(r.get(DANCE_LIST_ENTRIES.ID))
            .danceListId(r.get(DANCE_LIST_ENTRIES.DANCE_LIST_ID))
            .danceId(r.get(DANCE_LIST_ENTRIES.DANCE_ID))
            .freeTextName(r.get(DANCE_LIST_ENTRIES.FREE_TEXT_NAME))
            .suggestionId(r.get(DANCE_LIST_ENTRIES.SUGGESTION_ID))
            .playMode(r.get(DANCE_LIST_ENTRIES.PLAY_MODE))
            .position(r.get(DANCE_LIST_ENTRIES.POSITION))
            .createdAt(r.get(DANCE_LIST_ENTRIES.CREATED_AT))
            .build();
    }
}
