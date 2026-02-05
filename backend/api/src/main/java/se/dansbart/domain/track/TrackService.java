package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TrackService {

    private final TrackRepository trackRepository;
    private final PlaybackLinkRepository playbackLinkRepository;

    public Optional<Track> findById(UUID id) {
        return trackRepository.findById(id);
    }

    public Page<Track> findPlayableTracks(
            String mainStyle,
            String subStyle,
            String search,
            String source,
            String vocals,
            Boolean styleConfirmed,
            String musicGenre,
            Integer minBpm,
            Integer maxBpm,
            Integer minDuration,
            Integer maxDuration,
            Float minBounciness,
            Float maxBounciness,
            Float minArticulation,
            Float maxArticulation,
            Integer limit,
            Integer offset) {

        // Convert vocals string to Boolean hasVocals
        Boolean hasVocals = null;
        if ("instrumental".equals(vocals)) {
            hasVocals = false;
        } else if ("vocals".equals(vocals)) {
            hasVocals = true;
        }

        // Convert duration from seconds to milliseconds
        Integer minDurationMs = minDuration != null ? minDuration * 1000 : null;
        Integer maxDurationMs = maxDuration != null ? maxDuration * 1000 : null;

        // For style_confirmed, confidence >= 1.0 means user-confirmed
        Float minConfidence = styleConfirmed != null && styleConfirmed ? 1.0f : null;

        List<Track> tracks = trackRepository.findPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation,
            limit, offset
        );

        long total = trackRepository.countPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation
        );

        Pageable pageable = PageRequest.of(offset / limit, limit);
        return new PageImpl<>(tracks, pageable, total);
    }

    public List<Track> findSimilarTracks(UUID trackId, int limit) {
        return trackRepository.findSimilarTracks(trackId, limit);
    }

    public Page<Track> searchByTitle(String query, Pageable pageable) {
        return trackRepository.searchByTitle(query, pageable);
    }

    public List<Track> findByArtistId(UUID artistId) {
        return trackRepository.findByArtistId(artistId);
    }

    public List<Track> findByAlbumId(UUID albumId) {
        return trackRepository.findByAlbumId(albumId);
    }

    @Transactional
    public Optional<PlaybackLink> submitLink(UUID trackId, String platform, String deepLink) {
        if (!trackRepository.existsById(trackId)) {
            return Optional.empty();
        }
        if (playbackLinkRepository.existsByTrackIdAndPlatformAndDeepLink(trackId, platform, deepLink)) {
            return Optional.empty();
        }
        PlaybackLink link = PlaybackLink.builder()
            .trackId(trackId)
            .platform(platform)
            .deepLink(deepLink)
            .isWorking(true)
            .build();
        return Optional.of(playbackLinkRepository.save(link));
    }

    @Transactional
    public boolean reportBrokenLink(UUID linkId) {
        return playbackLinkRepository.findById(linkId)
            .map(link -> {
                link.setIsWorking(false);
                playbackLinkRepository.save(link);
                return true;
            })
            .orElse(false);
    }
}
