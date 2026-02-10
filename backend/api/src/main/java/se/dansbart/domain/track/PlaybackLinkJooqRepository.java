package se.dansbart.domain.track;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.PLAYBACK_LINKS;

@Repository
public class PlaybackLinkJooqRepository {

    private final DSLContext dsl;

    public PlaybackLinkJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean existsByTrackIdAndPlatformAndDeepLink(UUID trackId, String platform, String deepLink) {
        return dsl.fetchExists(
            dsl.selectOne().from(PLAYBACK_LINKS)
                .where(PLAYBACK_LINKS.TRACK_ID.eq(trackId))
                .and(PLAYBACK_LINKS.PLATFORM.eq(platform))
                .and(PLAYBACK_LINKS.DEEP_LINK.eq(deepLink))
        );
    }

    public PlaybackLink insert(PlaybackLink link) {
        UUID id = link.getId() != null ? link.getId() : UUID.randomUUID();
        dsl.insertInto(PLAYBACK_LINKS)
            .columns(PLAYBACK_LINKS.ID, PLAYBACK_LINKS.TRACK_ID, PLAYBACK_LINKS.PLATFORM, PLAYBACK_LINKS.DEEP_LINK, PLAYBACK_LINKS.IS_WORKING)
            .values(id, link.getTrackId(), link.getPlatform(), link.getDeepLink(), link.getIsWorking())
            .execute();
        link.setId(id);
        return link;
    }

    public Optional<PlaybackLink> findById(UUID id) {
        return dsl.selectFrom(PLAYBACK_LINKS)
            .where(PLAYBACK_LINKS.ID.eq(id))
            .fetchOptional(this::toPlaybackLink);
    }

    public void update(PlaybackLink link) {
        if (link.getId() == null) return;
        dsl.update(PLAYBACK_LINKS)
            .set(PLAYBACK_LINKS.IS_WORKING, link.getIsWorking())
            .where(PLAYBACK_LINKS.ID.eq(link.getId()))
            .execute();
    }

    private PlaybackLink toPlaybackLink(Record r) {
        return PlaybackLink.builder()
            .id(r.get(PLAYBACK_LINKS.ID))
            .trackId(r.get(PLAYBACK_LINKS.TRACK_ID))
            .platform(r.get(PLAYBACK_LINKS.PLATFORM))
            .deepLink(r.get(PLAYBACK_LINKS.DEEP_LINK))
            .isWorking(Boolean.TRUE.equals(r.get(PLAYBACK_LINKS.IS_WORKING)))
            .build();
    }
}
