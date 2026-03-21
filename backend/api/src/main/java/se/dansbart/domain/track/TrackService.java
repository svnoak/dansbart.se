package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.dto.TrackListDto;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TrackService {

    private final TrackJooqRepository trackJooqRepository;
    private final PlaybackLinkJooqRepository playbackLinkJooqRepository;

    public Optional<Track> findById(UUID id) {
        return trackJooqRepository.findById(id);
    }

    /** Find a single track as TrackListDto (includes danceStyle, subStyle, playback, artist). */
    public Optional<TrackListDto> findByIdAsListDto(UUID id) {
        List<TrackListDto> results = trackJooqRepository.findTrackListDtosByIds(List.of(id));
        return results.isEmpty() ? Optional.empty() : Optional.ofNullable(results.get(0));
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

        List<Track> tracks = trackJooqRepository.findPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation,
            limit, offset, null, null
        );

        long total = trackJooqRepository.countPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation
        );

        Pageable pageable = PageRequest.of(offset / limit, limit);
        return new PageImpl<>(tracks, pageable, total);
    }

    /** Playable tracks as TrackListDto (includes danceStyle, subStyle, playback, artist). */
    public Page<TrackListDto> findPlayableTracksAsListDtos(
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
            Integer offset,
            String sortBy,
            String sortDirection) {

        Boolean hasVocals = null;
        if ("instrumental".equals(vocals)) hasVocals = false;
        else if ("vocals".equals(vocals)) hasVocals = true;
        Integer minDurationMs = minDuration != null ? minDuration * 1000 : null;
        Integer maxDurationMs = maxDuration != null ? maxDuration * 1000 : null;
        Float minConfidence = styleConfirmed != null && styleConfirmed ? 1.0f : null;

        List<Track> tracks = trackJooqRepository.findPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation,
            limit, offset, sortBy, sortDirection
        );
        long total = trackJooqRepository.countPlayableTracksWithFilters(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation
        );
        List<UUID> ids = tracks.stream().map(Track::getId).toList();
        List<TrackListDto> content = trackJooqRepository.findTrackListDtosByIds(ids);
        if (mainStyle != null && !mainStyle.isBlank()) {
            Set<UUID> matchedOnSecondary = trackJooqRepository.findTrackIdsWithSecondaryStyle(ids, mainStyle);
            for (TrackListDto dto : content) {
                if (dto.getId() != null && matchedOnSecondary.contains(dto.getId())) {
                    dto.setMatchedStyle(mainStyle);
                }
            }
        }
        Pageable pageable = PageRequest.of(offset / limit, limit);
        return new PageImpl<>(content, pageable, total);
    }

    public List<Track> findSimilarTracks(UUID trackId, int limit) {
        return trackJooqRepository.findSimilarTracks(trackId, limit);
    }

    public Page<Track> searchByTitle(String query, Pageable pageable) {
        return trackJooqRepository.searchByTitle(query, pageable);
    }

    /** Search by title returning TrackListDto (includes danceStyle, subStyle, playback, artist). */
    public Page<TrackListDto> searchByTitleAsListDtos(String query, Pageable pageable) {
        Page<Track> page = trackJooqRepository.searchByTitle(query, pageable);
        List<UUID> ids = page.getContent().stream().map(Track::getId).toList();
        List<TrackListDto> content = trackJooqRepository.findTrackListDtosByIds(ids);
        return new PageImpl<>(content, pageable, page.getTotalElements());
    }

    public List<Track> findByArtistId(UUID artistId) {
        return trackJooqRepository.findByArtistId(artistId);
    }

    public List<Track> findByAlbumId(UUID albumId) {
        return trackJooqRepository.findByAlbumId(albumId);
    }

    /** Tracks on an album as TrackListDto (includes danceStyle, subStyle, playback, artist). */
    public List<TrackListDto> findByAlbumIdAsListDtos(UUID albumId) {
        List<Track> tracks = trackJooqRepository.findByAlbumId(albumId);
        return trackJooqRepository.findTrackListDtosByIds(tracks.stream().map(Track::getId).toList());
    }

    @Transactional
    public Optional<PlaybackLink> submitLink(UUID trackId, String platform, String deepLink) {
        if (!trackJooqRepository.existsById(trackId)) {
            return Optional.empty();
        }
        if (playbackLinkJooqRepository.existsByTrackIdAndPlatformAndDeepLink(trackId, platform, deepLink)) {
            return Optional.empty();
        }
        PlaybackLink link = PlaybackLink.builder()
            .trackId(trackId)
            .platform(platform)
            .deepLink(deepLink)
            .isWorking(true)
            .build();
        return Optional.of(playbackLinkJooqRepository.insert(link));
    }

    @Transactional
    public boolean reportBrokenLink(UUID linkId) {
        return playbackLinkJooqRepository.findById(linkId)
            .map(link -> {
                link.setIsWorking(false);
                playbackLinkJooqRepository.update(link);
                return true;
            })
            .orElse(false);
    }
}
