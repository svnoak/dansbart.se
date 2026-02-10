package se.dansbart.domain.discovery;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.CuratedPlaylistDto;
import se.dansbart.dto.StyleOverviewDto;
import se.dansbart.dto.TrackListDto;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiscoveryService {

    private final TrackJooqRepository trackJooqRepository;
    private final TrackPlaybackJooqRepository trackPlaybackRepository;

    private static final float MIN_COMPLETION_RATE = 50.0f;
    private static final List<String> COMMON_STYLES = List.of("Hambo", "Polska", "Vals", "Schottis", "Engelska", "Mazurka");

    /**
     * Get popular tracks based on play count and completion rate.
     * Falls back to recent high-confidence tracks if not enough quality plays.
     */
    public List<TrackListDto> findPopularTracks(int limit, int days) {
        OffsetDateTime since = OffsetDateTime.now().minusDays(days);

        // Get most played tracks with completion rate
        List<Object[]> playStats = trackPlaybackRepository.findMostPlayedTracks(since, limit * 2);

        // Filter for tracks with good completion rate
        List<UUID> qualityTrackIds = playStats.stream()
            .filter(row -> {
                double completionRate = ((Number) row[2]).doubleValue();
                return completionRate > MIN_COMPLETION_RATE;
            })
            .map(row -> (UUID) row[0])
            .limit(limit)
            .toList();

        if (qualityTrackIds.size() >= limit) {
            return trackJooqRepository.findTrackListDtosByIds(qualityTrackIds);
        }

        // Fallback: use recent high-confidence tracks
        List<Track> fallback = trackJooqRepository.findFallbackTracks(limit);
        return trackJooqRepository.findTrackListDtosByIds(fallback.stream().map(Track::getId).toList());
    }

    /**
     * Get recently added tracks with verified classification (confidence = 1.0).
     */
    public List<TrackListDto> findRecentTracks(int limit) {
        List<Track> tracks = trackJooqRepository.findRecentVerifiedTracks(limit);
        return trackJooqRepository.findTrackListDtosByIds(tracks.stream().map(Track::getId).toList());
    }

    /**
     * Get curated tracks: user-confirmed, analyzed, sorted by popularity.
     */
    public List<TrackListDto> findCuratedTracks(int limit) {
        List<Track> tracks = trackJooqRepository.findCuratedTracks(limit);
        return trackJooqRepository.findTrackListDtosByIds(tracks.stream().map(Track::getId).toList());
    }

    /**
     * Get style overview with track counts and sub-styles.
     */
    public List<StyleOverviewDto> getStyleOverview() {
        // Get style counts
        List<Object[]> styleCounts = trackJooqRepository.findStyleCounts();

        // Build style overview with sub-styles
        return styleCounts.stream()
            .map(row -> {
                String style = (String) row[0];
                Long count = ((Number) row[1]).longValue();
                List<String> subStyles = trackJooqRepository.findSubStylesForStyle(style);

                return StyleOverviewDto.builder()
                    .style(style)
                    .subStyles(subStyles)
                    .trackCount(count)
                    .build();
            })
            .toList();
    }

    /**
     * Get all curated playlists for discovery page.
     */
    public List<CuratedPlaylistDto> getCuratedPlaylists() {
        List<CuratedPlaylistDto> playlists = new ArrayList<>();

        // Party playlist
        CuratedPlaylistDto party = getPartyPlaylist();
        if (party != null) playlists.add(party);

        // Beginner friendly playlist
        CuratedPlaylistDto beginner = getBeginnerFriendlyPlaylist();
        if (beginner != null) playlists.add(beginner);

        // Slow dances playlist
        CuratedPlaylistDto slow = getSlowDancesPlaylist();
        if (slow != null) playlists.add(slow);

        // Fast dances playlist
        CuratedPlaylistDto fast = getFastDancesPlaylist();
        if (fast != null) playlists.add(fast);

        // Instrumental playlist
        CuratedPlaylistDto instrumental = getInstrumentalPlaylist();
        if (instrumental != null) playlists.add(instrumental);

        return playlists;
    }

    /**
     * Get party playlist: 2 polskas, 1 schottis, 1 vals, and variety.
     */
    private CuratedPlaylistDto getPartyPlaylist() {
        List<Track> allTracks = new ArrayList<>();

        // Get 2 polskas
        allTracks.addAll(trackJooqRepository.findByStyleWithConfidence("Polska", 0.8f, 2));

        // Get 1 schottis
        allTracks.addAll(trackJooqRepository.findByStyleWithConfidence("Schottis", 0.8f, 1));

        // Get 1 vals
        allTracks.addAll(trackJooqRepository.findByStyleWithConfidence("Vals", 0.8f, 1));

        // Get variety (hambo, engelska, mazurka)
        allTracks.addAll(trackJooqRepository.findByStylesWithConfidence(
            List.of("Hambo", "Engelska", "Mazurka"), 0.8f, 4));

        if (allTracks.isEmpty()) {
            return null;
        }

        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(
            allTracks.stream().limit(6).map(Track::getId).toList());
        return CuratedPlaylistDto.builder()
            .id("party")
            .name("Festspellista")
            .description("2 polskor, 1 schottis, 1 vals och lite variation")
            .trackCount(allTracks.size())
            .tracks(dtos)
            .build();
    }

    /**
     * Get beginner-friendly playlist: one from each style, instrumental, medium tempo.
     */
    private CuratedPlaylistDto getBeginnerFriendlyPlaylist() {
        List<Track> allTracks = new ArrayList<>();

        for (String style : COMMON_STYLES) {
            List<Track> styleTracks = trackJooqRepository.findBeginnerFriendlyByStyle(style, 4);
            allTracks.addAll(styleTracks);
        }

        if (allTracks.isEmpty()) {
            return null;
        }

        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(
            allTracks.stream().limit(6).map(Track::getId).toList());
        return CuratedPlaylistDto.builder()
            .id("beginner-friendly")
            .name("Perfekt för nybörjare")
            .description("En av varje dansstil, instrumental och lagom tempo")
            .trackCount(allTracks.size())
            .tracks(dtos)
            .build();
    }

    /**
     * Get instrumental playlist.
     */
    private CuratedPlaylistDto getInstrumentalPlaylist() {
        List<Track> tracks = trackJooqRepository.findInstrumentalTracks(0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(
            tracks.stream().limit(6).map(Track::getId).toList());
        return CuratedPlaylistDto.builder()
            .id("instrumental")
            .name("Rent instrumental")
            .description("Utan sång")
            .trackCount(tracks.size())
            .tracks(dtos)
            .build();
    }

    /**
     * Get slow dances playlist (BPM <= 100).
     */
    private CuratedPlaylistDto getSlowDancesPlaylist() {
        List<Track> tracks = trackJooqRepository.findSlowTracks(100, 0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(
            tracks.stream().limit(6).map(Track::getId).toList());
        return CuratedPlaylistDto.builder()
            .id("slow")
            .name("Lugna danser")
            .description("Lågt tempo och avslappnad känsla")
            .trackCount(tracks.size())
            .tracks(dtos)
            .build();
    }

    /**
     * Get fast dances playlist (BPM >= 140).
     */
    private CuratedPlaylistDto getFastDancesPlaylist() {
        List<Track> tracks = trackJooqRepository.findFastTracks(140, 0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(
            tracks.stream().limit(6).map(Track::getId).toList());
        return CuratedPlaylistDto.builder()
            .id("fast")
            .name("Snabba danser")
            .description("Högt tempo och energi")
            .trackCount(tracks.size())
            .tracks(dtos)
            .build();
    }

    /**
     * Helper to order tracks by a list of IDs.
     */
    private List<Track> orderByIds(List<Track> tracks, List<UUID> orderedIds) {
        Map<UUID, Track> trackMap = tracks.stream()
            .collect(Collectors.toMap(Track::getId, t -> t));

        return orderedIds.stream()
            .map(trackMap::get)
            .filter(Objects::nonNull)
            .toList();
    }
}
