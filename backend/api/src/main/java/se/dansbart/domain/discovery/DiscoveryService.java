package se.dansbart.domain.discovery;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.analytics.TrackPlaybackRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;
import se.dansbart.dto.CuratedPlaylistDto;
import se.dansbart.dto.StyleOverviewDto;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiscoveryService {

    private final TrackRepository trackRepository;
    private final TrackPlaybackRepository trackPlaybackRepository;

    private static final float MIN_COMPLETION_RATE = 50.0f;
    private static final List<String> COMMON_STYLES = List.of("Hambo", "Polska", "Vals", "Schottis", "Engelska", "Mazurka");

    /**
     * Get popular tracks based on play count and completion rate.
     * Falls back to recent high-confidence tracks if not enough quality plays.
     */
    public List<Track> findPopularTracks(int limit, int days) {
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
            // Fetch full track objects preserving order
            List<Track> tracks = trackRepository.findByIds(qualityTrackIds);
            return orderByIds(tracks, qualityTrackIds);
        }

        // Fallback: use recent high-confidence tracks
        return trackRepository.findFallbackTracks(limit);
    }

    /**
     * Get recently added tracks with verified classification (confidence = 1.0).
     */
    public List<Track> findRecentTracks(int limit) {
        return trackRepository.findRecentVerifiedTracks(limit);
    }

    /**
     * Get curated tracks: user-confirmed, analyzed, sorted by popularity.
     */
    public List<Track> findCuratedTracks(int limit) {
        return trackRepository.findCuratedTracks(limit);
    }

    /**
     * Get style overview with track counts and sub-styles.
     */
    public List<StyleOverviewDto> getStyleOverview() {
        // Get style counts
        List<Object[]> styleCounts = trackRepository.findStyleCounts();

        // Build style overview with sub-styles
        return styleCounts.stream()
            .map(row -> {
                String style = (String) row[0];
                Long count = ((Number) row[1]).longValue();
                List<String> subStyles = trackRepository.findSubStylesForStyle(style);

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
        allTracks.addAll(trackRepository.findByStyleWithConfidence("Polska", 0.8f, 2));

        // Get 1 schottis
        allTracks.addAll(trackRepository.findByStyleWithConfidence("Schottis", 0.8f, 1));

        // Get 1 vals
        allTracks.addAll(trackRepository.findByStyleWithConfidence("Vals", 0.8f, 1));

        // Get variety (hambo, engelska, mazurka)
        allTracks.addAll(trackRepository.findByStylesWithConfidence(
            List.of("Hambo", "Engelska", "Mazurka"), 0.8f, 4));

        if (allTracks.isEmpty()) {
            return null;
        }

        return CuratedPlaylistDto.builder()
            .id("party")
            .name("Festspellista")
            .description("2 polskor, 1 schottis, 1 vals och lite variation")
            .trackCount(allTracks.size())
            .tracks(allTracks.stream().limit(6).toList())
            .build();
    }

    /**
     * Get beginner-friendly playlist: one from each style, instrumental, medium tempo.
     */
    private CuratedPlaylistDto getBeginnerFriendlyPlaylist() {
        List<Track> allTracks = new ArrayList<>();

        for (String style : COMMON_STYLES) {
            List<Track> styleTracks = trackRepository.findBeginnerFriendlyByStyle(style, 4);
            allTracks.addAll(styleTracks);
        }

        if (allTracks.isEmpty()) {
            return null;
        }

        return CuratedPlaylistDto.builder()
            .id("beginner-friendly")
            .name("Perfekt för nybörjare")
            .description("En av varje dansstil, instrumental och lagom tempo")
            .trackCount(allTracks.size())
            .tracks(allTracks.stream().limit(6).toList())
            .build();
    }

    /**
     * Get instrumental playlist.
     */
    private CuratedPlaylistDto getInstrumentalPlaylist() {
        List<Track> tracks = trackRepository.findInstrumentalTracks(0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        return CuratedPlaylistDto.builder()
            .id("instrumental")
            .name("Rent instrumental")
            .description("Utan sång")
            .trackCount(tracks.size())
            .tracks(tracks.stream().limit(6).toList())
            .build();
    }

    /**
     * Get slow dances playlist (BPM <= 100).
     */
    private CuratedPlaylistDto getSlowDancesPlaylist() {
        List<Track> tracks = trackRepository.findSlowTracks(100, 0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        return CuratedPlaylistDto.builder()
            .id("slow")
            .name("Lugna danser")
            .description("Lågt tempo och avslappnad känsla")
            .trackCount(tracks.size())
            .tracks(tracks.stream().limit(6).toList())
            .build();
    }

    /**
     * Get fast dances playlist (BPM >= 140).
     */
    private CuratedPlaylistDto getFastDancesPlaylist() {
        List<Track> tracks = trackRepository.findFastTracks(140, 0.7f, 8);

        if (tracks.isEmpty()) {
            return null;
        }

        return CuratedPlaylistDto.builder()
            .id("fast")
            .name("Snabba danser")
            .description("Högt tempo och energi")
            .trackCount(tracks.size())
            .tracks(tracks.stream().limit(6).toList())
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
