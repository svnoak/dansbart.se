package se.dansbart.domain.guestcode;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.LIST_GUEST_CODES;

@Repository
public class GuestCodeJooqRepository {

    private final DSLContext dsl;

    public GuestCodeJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<GuestCode> findByCode(String code) {
        return dsl.selectFrom(LIST_GUEST_CODES).where(LIST_GUEST_CODES.CODE.eq(code)).fetchOptional(this::toGuestCode);
    }

    public Optional<String> findCodeByPlaylistId(UUID playlistId) {
        return dsl.select(LIST_GUEST_CODES.CODE).from(LIST_GUEST_CODES)
            .where(LIST_GUEST_CODES.PLAYLIST_ID.eq(playlistId))
            .fetchOptional(LIST_GUEST_CODES.CODE);
    }

    public Optional<String> findCodeByDanceListId(UUID danceListId) {
        return dsl.select(LIST_GUEST_CODES.CODE).from(LIST_GUEST_CODES)
            .where(LIST_GUEST_CODES.DANCE_LIST_ID.eq(danceListId))
            .fetchOptional(LIST_GUEST_CODES.CODE);
    }

    public boolean existsByCode(String code) {
        return dsl.fetchExists(dsl.selectOne().from(LIST_GUEST_CODES).where(LIST_GUEST_CODES.CODE.eq(code)));
    }

    public void insert(String code, UUID playlistId, UUID danceListId, UUID createdBy) {
        dsl.insertInto(LIST_GUEST_CODES)
            .set(LIST_GUEST_CODES.CODE, code)
            .set(LIST_GUEST_CODES.PLAYLIST_ID, playlistId)
            .set(LIST_GUEST_CODES.DANCE_LIST_ID, danceListId)
            .set(LIST_GUEST_CODES.CREATED_BY, createdBy)
            .execute();
    }

    public void deleteByPlaylistId(UUID playlistId) {
        dsl.deleteFrom(LIST_GUEST_CODES).where(LIST_GUEST_CODES.PLAYLIST_ID.eq(playlistId)).execute();
    }

    public void deleteByDanceListId(UUID danceListId) {
        dsl.deleteFrom(LIST_GUEST_CODES).where(LIST_GUEST_CODES.DANCE_LIST_ID.eq(danceListId)).execute();
    }

    private GuestCode toGuestCode(Record r) {
        return new GuestCode(
            r.get(LIST_GUEST_CODES.CODE),
            r.get(LIST_GUEST_CODES.PLAYLIST_ID),
            r.get(LIST_GUEST_CODES.DANCE_LIST_ID),
            r.get(LIST_GUEST_CODES.CREATED_BY),
            r.get(LIST_GUEST_CODES.CREATED_AT));
    }
}
