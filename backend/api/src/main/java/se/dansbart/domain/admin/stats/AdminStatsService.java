package se.dansbart.domain.admin.stats;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.stats.StatsService;
import se.dansbart.domain.track.TrackJooqRepository;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    private final StatsService statsService;
    private final TrackJooqRepository trackRepository;
    private final TrackPlaybackJooqRepository playbackRepository;

    public AdminStatsDto getAdminStats() {
        long privateTrackCount = trackRepository.countPrivateTracks();

        var playsByPrivacy = playbackRepository.countPlaysByPrivacy();
        long publicPlayCount = playsByPrivacy.getOrDefault(false, 0);
        long privatePlayCount = playsByPrivacy.getOrDefault(true, 0);

        return new AdminStatsDto(
            statsService.getLibraryStats(),
            privateTrackCount,
            publicPlayCount,
            privatePlayCount
        );
    }
}
