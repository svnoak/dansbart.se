package se.dansbart.domain.track;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PlaybackLinkRepository extends JpaRepository<PlaybackLink, UUID> {

    boolean existsByTrackIdAndPlatformAndDeepLink(UUID trackId, String platform, String deepLink);
}
