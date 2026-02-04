package se.dansbart.domain.admin.artist;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogRepository;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumRepository;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistRepository;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminArtistService {

    private final ArtistRepository artistRepository;
    private final AlbumRepository albumRepository;
    private final TrackRepository trackRepository;
    private final RejectionLogRepository rejectionLogRepository;
    private final TaskDispatcher taskDispatcher;

    @Transactional(readOnly = true)
    public Map<String, Object> getArtistsPaginated(String search, String isolated, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<Artist> page;

        if (search != null && !search.isBlank()) {
            page = artistRepository.searchByName(search, pageable);
        } else if ("true".equalsIgnoreCase(isolated)) {
            // Isolated artists = not verified and have pending tracks
            page = artistRepository.findAll(pageable);
            // Filter in memory for isolation (simplified - could be optimized with custom query)
        } else {
            page = artistRepository.findAll(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapArtistToAdmin)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private Map<String, Object> mapArtistToAdmin(Artist artist) {
        long trackCount = artist.getTrackLinks() != null ? artist.getTrackLinks().size() : 0;
        long pendingCount = artist.getTrackLinks() != null ?
            artist.getTrackLinks().stream()
                .filter(tl -> tl.getTrack() != null && "PENDING".equals(tl.getTrack().getProcessingStatus()))
                .count() : 0;

        Map<String, Object> item = new HashMap<>();
        item.put("id", artist.getId().toString());
        item.put("name", artist.getName());
        item.put("spotify_id", artist.getSpotifyId());
        item.put("image_url", artist.getImageUrl());
        item.put("is_verified", artist.getIsVerified());
        item.put("track_count", trackCount);
        item.put("pending_count", pendingCount);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getArtistIsolationInfo(UUID artistId) {
        Artist artist = artistRepository.findById(artistId).orElse(null);
        if (artist == null) {
            return Map.of("error", "Artist not found");
        }

        // Get all tracks by this artist
        List<Track> artistTracks = artist.getTrackLinks().stream()
            .map(TrackArtist::getTrack)
            .filter(Objects::nonNull)
            .toList();

        // Check for collaborating artists
        Set<UUID> collaboratingArtistIds = new HashSet<>();
        for (Track track : artistTracks) {
            for (TrackArtist ta : track.getArtistLinks()) {
                if (!ta.getArtist().getId().equals(artistId)) {
                    collaboratingArtistIds.add(ta.getArtist().getId());
                }
            }
        }

        // Get shared albums
        List<Album> artistAlbums = albumRepository.findByArtistId(artistId);
        Set<UUID> sharedAlbumIds = new HashSet<>();
        for (Album album : artistAlbums) {
            if (album.getTrackLinks() != null && album.getTrackLinks().size() > artistTracks.size()) {
                sharedAlbumIds.add(album.getId());
            }
        }

        boolean isIsolated = collaboratingArtistIds.isEmpty() && sharedAlbumIds.isEmpty();

        Map<String, Object> result = new HashMap<>();
        result.put("is_isolated", isIsolated);
        result.put("collaborating_artist_count", collaboratingArtistIds.size());
        result.put("shared_album_count", sharedAlbumIds.size());
        result.put("total_tracks", artistTracks.size());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCollaborationNetwork(UUID artistId) {
        Artist artist = artistRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        List<Track> artistTracks = artist.getTrackLinks().stream()
            .map(TrackArtist::getTrack)
            .filter(Objects::nonNull)
            .toList();

        // Get collaborating artists
        Map<UUID, Artist> collaborators = new HashMap<>();
        for (Track track : artistTracks) {
            for (TrackArtist ta : track.getArtistLinks()) {
                if (!ta.getArtist().getId().equals(artistId)) {
                    collaborators.put(ta.getArtist().getId(), ta.getArtist());
                }
            }
        }

        List<Map<String, Object>> collaboratorList = collaborators.values().stream()
            .map(a -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", a.getId().toString());
                m.put("name", a.getName());
                m.put("spotify_id", a.getSpotifyId());
                return m;
            })
            .toList();

        // Get albums
        List<Album> albums = albumRepository.findByArtistId(artistId);
        List<Map<String, Object>> albumList = albums.stream()
            .map(a -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", a.getId().toString());
                m.put("title", a.getTitle());
                m.put("spotify_id", a.getSpotifyId());
                return m;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("artist_id", artistId.toString());
        result.put("artist_name", artist.getName());
        result.put("collaborating_artists", collaboratorList);
        result.put("albums", albumList);
        return result;
    }

    @Transactional
    public Map<String, Object> rejectArtist(UUID artistId, String reason, boolean dryRun, boolean deleteContent) {
        Artist artist = artistRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        // Get pending tracks
        List<Track> pendingTracks = artist.getTrackLinks().stream()
            .map(TrackArtist::getTrack)
            .filter(t -> t != null && "PENDING".equals(t.getProcessingStatus()))
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("artist_id", artistId.toString());
        result.put("artist_name", artist.getName());
        result.put("pending_tracks_to_delete", pendingTracks.size());
        result.put("dry_run", dryRun);

        if (!dryRun) {
            // Add to blocklist
            if (artist.getSpotifyId() != null) {
                RejectionLog rejection = RejectionLog.builder()
                    .entityType("artist")
                    .spotifyId(artist.getSpotifyId())
                    .entityName(artist.getName())
                    .reason(reason)
                    .deletedContent(deleteContent)
                    .build();
                rejectionLogRepository.save(rejection);
            }

            // Delete pending tracks if requested
            if (deleteContent) {
                for (Track track : pendingTracks) {
                    trackRepository.delete(track);
                }
                result.put("deleted_tracks", pendingTracks.size());
            }

            result.put("status", "success");
            result.put("message", "Artist rejected and added to blocklist");
        }

        return result;
    }

    @Transactional
    public Map<String, Object> approveArtist(UUID artistId) {
        Artist artist = artistRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        // Mark as verified
        artist.setIsVerified(true);
        artistRepository.save(artist);

        // Queue pending tracks for analysis
        List<Track> pendingTracks = artist.getTrackLinks().stream()
            .map(TrackArtist::getTrack)
            .filter(t -> t != null && "PENDING".equals(t.getProcessingStatus()))
            .toList();

        for (Track track : pendingTracks) {
            taskDispatcher.dispatchAudioAnalysis(track.getId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("artist_id", artistId.toString());
        result.put("artist_name", artist.getName());
        result.put("queued_tracks", pendingTracks.size());
        return result;
    }

    @Transactional
    public Map<String, Object> bulkRejectArtists(List<String> ids, String reason, boolean deleteContent) {
        int rejected = 0;
        List<String> failed = new ArrayList<>();

        for (String idStr : ids) {
            try {
                UUID id = UUID.fromString(idStr);
                rejectArtist(id, reason, false, deleteContent);
                rejected++;
            } catch (Exception e) {
                failed.add(idStr + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("rejected", rejected);
        result.put("failed", failed);
        return result;
    }

    @Transactional
    public Map<String, Object> bulkApproveArtists(List<String> ids) {
        int approved = 0;
        int queuedTracks = 0;
        List<String> failed = new ArrayList<>();

        for (String idStr : ids) {
            try {
                UUID id = UUID.fromString(idStr);
                Map<String, Object> approvalResult = approveArtist(id);
                approved++;
                queuedTracks += (int) approvalResult.getOrDefault("queued_tracks", 0);
            } catch (Exception e) {
                failed.add(idStr + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("approved", approved);
        result.put("queued_tracks", queuedTracks);
        result.put("failed", failed);
        return result;
    }

    @Transactional
    public Map<String, Object> rejectNetwork(List<String> artistIds, List<String> albumIds, String reason) {
        int rejectedArtists = 0;
        int rejectedAlbums = 0;
        int deletedTracks = 0;

        // Reject artists
        for (String idStr : artistIds) {
            try {
                UUID id = UUID.fromString(idStr);
                Map<String, Object> result = rejectArtist(id, reason, false, true);
                rejectedArtists++;
                deletedTracks += (int) result.getOrDefault("deleted_tracks", 0);
            } catch (Exception ignored) {}
        }

        // Reject albums
        for (String idStr : albumIds) {
            try {
                UUID id = UUID.fromString(idStr);
                Album album = albumRepository.findById(id).orElse(null);
                if (album != null && album.getSpotifyId() != null) {
                    RejectionLog rejection = RejectionLog.builder()
                        .entityType("album")
                        .spotifyId(album.getSpotifyId())
                        .entityName(album.getTitle())
                        .reason(reason)
                        .deletedContent(true)
                        .build();
                    rejectionLogRepository.save(rejection);
                    rejectedAlbums++;
                }
            } catch (Exception ignored) {}
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("rejected_artists", rejectedArtists);
        result.put("rejected_albums", rejectedAlbums);
        result.put("deleted_tracks", deletedTracks);
        return result;
    }
}
