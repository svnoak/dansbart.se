package se.dansbart.domain.dance;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.select;
import static se.dansbart.jooq.Tables.*;

@Repository
public class DanceJooqRepository {

    private final DSLContext dsl;

    public DanceJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Page<Dance> findAll(String search, String danceType, Pageable pageable) {
        Condition condition = DSL.trueCondition();
        if (search != null && !search.isBlank()) {
            condition = condition.and(DANCES.NAME.lower().like("%" + search.toLowerCase() + "%"));
        }
        if (danceType != null && !danceType.isBlank()) {
            condition = condition.and(DANCES.DANCE_TYPE.equalIgnoreCase(danceType));
        }

        List<Dance> items = dsl.selectFrom(DANCES)
                .where(condition)
                .orderBy(DANCES.NAME.asc())
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .fetch(this::toDance);

        long total = dsl.fetchCount(dsl.selectFrom(DANCES).where(condition));
        return new PageImpl<>(items, pageable, total);
    }

    public Optional<Dance> findById(UUID id) {
        return dsl.selectFrom(DANCES)
                .where(DANCES.ID.eq(id))
                .fetchOptional()
                .map(this::toDance);
    }

    public Optional<Dance> findBySlug(String slug) {
        return dsl.selectFrom(DANCES)
                .where(DANCES.SLUG.eq(slug))
                .fetchOptional()
                .map(this::toDance);
    }

    public long countConfirmedTracksByDanceId(UUID danceId) {
        return dsl.fetchCount(
                dsl.selectFrom(DANCE_TRACKS)
                        .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                        .and(DANCE_TRACKS.IS_CONFIRMED.isTrue())
        );
    }

    public Map<UUID, Integer> countConfirmedByDanceIds(List<UUID> danceIds) {
        if (danceIds.isEmpty()) return Map.of();
        return dsl.select(DANCE_TRACKS.DANCE_ID, count())
                .from(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.in(danceIds))
                .and(DANCE_TRACKS.IS_CONFIRMED.isTrue())
                .groupBy(DANCE_TRACKS.DANCE_ID)
                .fetchMap(DANCE_TRACKS.DANCE_ID, count());
    }

    public List<DanceTrack> findConfirmedTracksByDanceId(UUID danceId) {
        return dsl.selectFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.IS_CONFIRMED.isTrue())
                .fetch(this::toDanceTrack);
    }

    public Optional<DanceTrack> findDanceTrackById(UUID id) {
        return dsl.selectFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.ID.eq(id))
                .fetchOptional()
                .map(this::toDanceTrack);
    }

    public Optional<DanceTrack> findDanceTrackByDanceAndTrack(UUID danceId, UUID trackId) {
        return dsl.selectFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.TRACK_ID.eq(trackId))
                .fetchOptional()
                .map(this::toDanceTrack);
    }

    public List<DanceTrack> findPendingLinks(Pageable pageable) {
        return dsl.select(
                        DANCE_TRACKS.ID,
                        DANCE_TRACKS.DANCE_ID,
                        DANCE_TRACKS.TRACK_ID,
                        DANCE_TRACKS.ADDED_BY,
                        DANCE_TRACKS.ADDED_AT,
                        DANCE_TRACKS.IS_CONFIRMED,
                        DANCE_TRACKS.CONFIRMED_BY,
                        DANCE_TRACKS.CONFIRMED_AT,
                        DANCES.NAME.as("dance_name"),
                        TRACKS.TITLE.as("track_title")
                )
                .from(DANCE_TRACKS)
                .join(DANCES).on(DANCES.ID.eq(DANCE_TRACKS.DANCE_ID))
                .join(TRACKS).on(TRACKS.ID.eq(DANCE_TRACKS.TRACK_ID))
                .where(DANCE_TRACKS.IS_CONFIRMED.isFalse())
                .orderBy(DANCE_TRACKS.ADDED_AT.asc())
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .fetch(r -> toDanceTrackWithNames(r,
                        r.get("dance_name", String.class),
                        r.get("track_title", String.class)));
    }

    public long countPendingLinks() {
        return dsl.fetchCount(
                dsl.selectFrom(DANCE_TRACKS).where(DANCE_TRACKS.IS_CONFIRMED.isFalse())
        );
    }

    @Transactional
    public DanceTrack addTrack(UUID danceId, UUID trackId, UUID addedBy) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(DANCE_TRACKS)
                .columns(DANCE_TRACKS.ID, DANCE_TRACKS.DANCE_ID, DANCE_TRACKS.TRACK_ID, DANCE_TRACKS.ADDED_BY)
                .values(id, danceId, trackId, addedBy)
                .onConflict(DANCE_TRACKS.DANCE_ID, DANCE_TRACKS.TRACK_ID)
                .doNothing()
                .execute();
        return dsl.selectFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.TRACK_ID.eq(trackId))
                .fetchOne(this::toDanceTrack);
    }

    @Transactional
    public void confirmTrack(UUID danceTrackId, UUID adminId) {
        dsl.update(DANCE_TRACKS)
                .set(DANCE_TRACKS.IS_CONFIRMED, true)
                .set(DANCE_TRACKS.CONFIRMED_BY, adminId)
                .set(DANCE_TRACKS.CONFIRMED_AT, OffsetDateTime.now())
                .where(DANCE_TRACKS.ID.eq(danceTrackId))
                .execute();
    }

    @Transactional
    public void removeTrack(UUID danceId, UUID trackId) {
        dsl.deleteFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.TRACK_ID.eq(trackId))
                .execute();
    }

    @Transactional
    public boolean update(UUID id, String name, String slug, String danceDescriptionUrl, String danceType, String music) {
        int rows = dsl.update(DANCES)
                .set(DANCES.NAME, name)
                .set(DANCES.SLUG, slug)
                .set(DANCES.DANCE_DESCRIPTION_URL, danceDescriptionUrl)
                .set(DANCES.DANCE_TYPE, danceType)
                .set(DANCES.MUSIC, music)
                .where(DANCES.ID.eq(id))
                .execute();
        return rows > 0;
    }

    @Transactional
    public boolean delete(UUID id) {
        int rows = dsl.deleteFrom(DANCES)
                .where(DANCES.ID.eq(id))
                .execute();
        return rows > 0;
    }

    @Transactional
    public DanceTrack addTrackConfirmed(UUID danceId, UUID trackId, UUID adminId) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(DANCE_TRACKS)
                .columns(DANCE_TRACKS.ID, DANCE_TRACKS.DANCE_ID, DANCE_TRACKS.TRACK_ID,
                        DANCE_TRACKS.ADDED_BY, DANCE_TRACKS.IS_CONFIRMED,
                        DANCE_TRACKS.CONFIRMED_BY, DANCE_TRACKS.CONFIRMED_AT)
                .values(id, danceId, trackId, adminId, true, adminId, OffsetDateTime.now())
                .onConflict(DANCE_TRACKS.DANCE_ID, DANCE_TRACKS.TRACK_ID)
                .doUpdate()
                .set(DANCE_TRACKS.IS_CONFIRMED, true)
                .set(DANCE_TRACKS.CONFIRMED_BY, adminId)
                .set(DANCE_TRACKS.CONFIRMED_AT, OffsetDateTime.now())
                .execute();
        return dsl.selectFrom(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.TRACK_ID.eq(trackId))
                .fetchOne(this::toDanceTrack);
    }

    public List<Dance> findDancesWithInvalidStyle(Pageable pageable) {
        var validStyles = dsl.select(DANCE_STYLE_CONFIG.MAIN_STYLE).from(DANCE_STYLE_CONFIG);
        return dsl.selectFrom(DANCES)
                .where(DANCES.DANCE_TYPE.isNotNull())
                .and(DANCES.DANCE_TYPE.ne(""))
                .and(DANCES.DANCE_TYPE.notIn(validStyles))
                .orderBy(DANCES.DANCE_TYPE.asc(), DANCES.NAME.asc())
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .fetch(this::toDance);
    }

    public long countDancesWithInvalidStyle() {
        var validStyles = dsl.select(DANCE_STYLE_CONFIG.MAIN_STYLE).from(DANCE_STYLE_CONFIG);
        return dsl.fetchCount(
                dsl.selectFrom(DANCES)
                        .where(DANCES.DANCE_TYPE.isNotNull())
                        .and(DANCES.DANCE_TYPE.ne(""))
                        .and(DANCES.DANCE_TYPE.notIn(validStyles))
        );
    }

    public List<UUID> findTrackIdsByTitleFragment(String fragment) {
        return dsl.select(TRACKS.ID)
                .from(TRACKS)
                .where(org.jooq.impl.DSL.lower(TRACKS.TITLE).like("%" + fragment.toLowerCase() + "%"))
                .limit(5)
                .fetch(TRACKS.ID);
    }

    public List<UUID> findRecommendedTrackIds(UUID danceId, String danceType, String danceName, String music,
                                               int limit, int offset, List<UUID> exclude) {
        var confirmed = dsl.select(DANCE_TRACKS.TRACK_ID)
                .from(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.IS_CONFIRMED.isTrue());

        // Name/music matches bypass the style filter — explicit human curation trumps ML classification.
        Condition nameMatch = danceName.isBlank() ? DSL.falseCondition()
                : DSL.lower(TRACKS.TITLE).like("%" + danceName.toLowerCase() + "%");
        Condition musicMatch = (music == null || music.isBlank()) ? DSL.falseCondition()
                : DSL.lower(TRACKS.TITLE).like("%" + music.toLowerCase() + "%");
        Condition styleMatch = DSL.exists(
                dsl.selectOne().from(TRACK_DANCE_STYLES)
                        .where(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
                        .and(TRACK_DANCE_STYLES.IS_PRIMARY.isTrue())
                        .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(danceType)));

        Field<Integer> priority = DSL.case_()
                .when(nameMatch, 1)
                .when(musicMatch, 2)
                .otherwise(3);

        Condition excludeCondition = exclude.isEmpty() ? DSL.trueCondition() : TRACKS.ID.notIn(exclude);

        return dsl.select(TRACKS.ID)
                .from(TRACKS)
                .where(nameMatch.or(musicMatch).or(styleMatch))
                .and(TRACKS.ID.notIn(confirmed))
                .and(excludeCondition)
                .orderBy(priority.asc(), TRACKS.TITLE.asc())
                .limit(limit)
                .offset(offset)
                .fetch(TRACKS.ID);
    }

    public long countRecommendedTracks(UUID danceId, String danceType, String danceName, String music,
                                        List<UUID> exclude) {
        var confirmed = dsl.select(DANCE_TRACKS.TRACK_ID)
                .from(DANCE_TRACKS)
                .where(DANCE_TRACKS.DANCE_ID.eq(danceId))
                .and(DANCE_TRACKS.IS_CONFIRMED.isTrue());

        Condition nameMatch = danceName.isBlank() ? DSL.falseCondition()
                : DSL.lower(TRACKS.TITLE).like("%" + danceName.toLowerCase() + "%");
        Condition musicMatch = (music == null || music.isBlank()) ? DSL.falseCondition()
                : DSL.lower(TRACKS.TITLE).like("%" + music.toLowerCase() + "%");
        Condition styleMatch = DSL.exists(
                dsl.selectOne().from(TRACK_DANCE_STYLES)
                        .where(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
                        .and(TRACK_DANCE_STYLES.IS_PRIMARY.isTrue())
                        .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(danceType)));

        Condition excludeCondition = exclude.isEmpty() ? DSL.trueCondition() : TRACKS.ID.notIn(exclude);

        return dsl.fetchCount(
                dsl.select(TRACKS.ID).from(TRACKS)
                        .where(nameMatch.or(musicMatch).or(styleMatch))
                        .and(TRACKS.ID.notIn(confirmed))
                        .and(excludeCondition)
        );
    }

    /**
     * Upsert dances by slug. Existing slugs get their name and URL updated;
     * new slugs are inserted. Returns the number of rows processed.
     */
    @Transactional
    public int upsertDances(List<Dance> dances) {
        int count = 0;
        for (Dance dance : dances) {
            count += dsl.insertInto(DANCES)
                    .columns(DANCES.ID, DANCES.NAME, DANCES.SLUG, DANCES.DANCE_DESCRIPTION_URL,
                            DANCES.DANCE_TYPE, DANCES.MUSIC)
                    .values(UUID.randomUUID(), dance.getName(), dance.getSlug(),
                            dance.getDanceDescriptionUrl(), dance.getDanceType(), dance.getMusic())
                    .onConflict(DANCES.SLUG)
                    .doUpdate()
                    .set(DANCES.NAME, dance.getName())
                    .set(DANCES.DANCE_DESCRIPTION_URL, dance.getDanceDescriptionUrl())
                    .set(DANCES.DANCE_TYPE, dance.getDanceType())
                    .set(DANCES.MUSIC, dance.getMusic())
                    .execute();
        }
        return count;
    }

    private Dance toDance(Record r) {
        return Dance.builder()
                .id(r.get(DANCES.ID))
                .name(r.get(DANCES.NAME))
                .slug(r.get(DANCES.SLUG))
                .danceDescriptionUrl(r.get(DANCES.DANCE_DESCRIPTION_URL))
                .danceType(r.get(DANCES.DANCE_TYPE))
                .music(r.get(DANCES.MUSIC))
                .createdAt(r.get(DANCES.CREATED_AT))
                .build();
    }

    private DanceTrack toDanceTrack(Record r) {
        return DanceTrack.builder()
                .id(r.get(DANCE_TRACKS.ID))
                .danceId(r.get(DANCE_TRACKS.DANCE_ID))
                .trackId(r.get(DANCE_TRACKS.TRACK_ID))
                .addedBy(r.get(DANCE_TRACKS.ADDED_BY))
                .addedAt(r.get(DANCE_TRACKS.ADDED_AT))
                .isConfirmed(Boolean.TRUE.equals(r.get(DANCE_TRACKS.IS_CONFIRMED)))
                .confirmedBy(r.get(DANCE_TRACKS.CONFIRMED_BY))
                .confirmedAt(r.get(DANCE_TRACKS.CONFIRMED_AT))
                .build();
    }

    private DanceTrack toDanceTrackWithNames(Record r, String danceName, String trackTitle) {
        DanceTrack dt = toDanceTrack(r);
        dt.setDanceName(danceName);
        dt.setTrackTitle(trackTitle);
        return dt;
    }
}
