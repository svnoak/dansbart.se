package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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
            String style,
            Integer minBpm,
            Integer maxBpm,
            Boolean hasVocals,
            Pageable pageable) {
        return trackRepository.findPlayableTracks(style, minBpm, maxBpm, hasVocals, pageable);
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
