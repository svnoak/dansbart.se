package se.dansbart.domain.admin.artist;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogJooqRepository;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminArtistService {

    private final ArtistJooqRepository artistJooqRepository;
    private final AlbumJooqRepository albumJooqRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final RejectionLogJooqRepository rejectionLogJooqRepository;
    private final TaskDispatcher taskDispatcher;

    @Transactional(readOnly = true)
    public Map<String, Object> getArtistsPaginated(String search, String isolated, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<Artist> page;

        if (search != null && !search.isBlank()) {
            page = artistJooqRepository.searchByName(search, pageable);
        } else if ("true".equalsIgnoreCase(isolated)) {
            // Isolated artists = not verified and have pending tracks
            page = artistJooqRepository.findAll(pageable);
            // Filter in memory for isolation (simplified - could be optimized with custom query)
        } else {
            page = artistJooqRepository.findAll(pageable);
        }

        List<Map<String, Object>> items = mapArtistsToAdmin(page.getContent());

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private List<Map<String, Object>> mapArtistsToAdmin(List<Artist> artists) {
        if (artists.isEmpty()) return List.of();
        List<UUID> artistIds = artists.stream().map(Artist::getId).toList();
        Map<UUID, Long> pendingByArtist = new HashMap<>();
        for (Object[] row : artistJooqRepository.countPendingTracksByArtistIds(artistIds)) {
            UUID id = row[0] instanceof UUID ? (UUID) row[0] : UUID.fromString(row[0].toString());
            long count = ((Number) row[1]).longValue();
            pendingByArtist.put(id, count);
        }
        Map<UUID, Long> trackCountByArtist = artistJooqRepository.findTrackCountByArtistIds(artistIds);
        return artists.stream()
            .map(a -> mapArtistToAdmin(a, pendingByArtist.getOrDefault(a.getId(), 0L), trackCountByArtist.getOrDefault(a.getId(), 0L)))
            .toList();
    }

    private Map<String, Object> mapArtistToAdmin(Artist artist, long pendingCount, long trackCount) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", artist.getId().toString());
        item.put("name", artist.getName());
        item.put("spotifyId", artist.getSpotifyId());
        item.put("imageUrl", artist.getImageUrl());
        item.put("isVerified", artist.getIsVerified());
        item.put("trackCount", trackCount);
        item.put("pendingCount", pendingCount);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getArtistIsolationInfo(UUID artistId) {
        Artist artist = artistJooqRepository.findById(artistId).orElse(null);
        if (artist == null) {
            return Map.of("error", "Artist not found");
        }

        List<UUID> trackIds = artistJooqRepository.getTrackIdsByArtistId(artistId);
        Set<UUID> collaboratingArtistIds = new HashSet<>();
        if (!trackIds.isEmpty()) {
            for (Object[] row : artistJooqRepository.getTrackArtistsByTrackIds(trackIds)) {
                UUID aid = (UUID) row[1];
                if (!aid.equals(artistId)) {
                    collaboratingArtistIds.add(aid);
                }
            }
        }

        // Get shared albums
        List<Album> artistAlbums = albumJooqRepository.findByArtistId(artistId);
        Set<UUID> sharedAlbumIds = new HashSet<>();
        for (Album album : artistAlbums) {
            if (album.getTrackLinks() != null && album.getTrackLinks().size() > trackIds.size()) {
                sharedAlbumIds.add(album.getId());
            }
        }

        boolean isIsolated = collaboratingArtistIds.isEmpty() && sharedAlbumIds.isEmpty();

        Map<String, Object> result = new HashMap<>();
        result.put("isIsolated", isIsolated);
        result.put("collaboratingArtistCount", collaboratingArtistIds.size());
        result.put("sharedAlbumCount", sharedAlbumIds.size());
        result.put("totalTracks", trackIds.size());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCollaborationNetwork(UUID artistId) {
        Artist artist = artistJooqRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        List<UUID> trackIds = artistJooqRepository.getTrackIdsByArtistId(artistId);
        Set<UUID> collaboratorIds = new HashSet<>();
        if (!trackIds.isEmpty()) {
            for (Object[] row : artistJooqRepository.getTrackArtistsByTrackIds(trackIds)) {
                UUID aid = (UUID) row[1];
                if (!aid.equals(artistId)) {
                    collaboratorIds.add(aid);
                }
            }
        }

        List<Artist> collaboratorsList = collaboratorIds.isEmpty() ? List.of() : artistJooqRepository.findByIds(new ArrayList<>(collaboratorIds));
        List<Map<String, Object>> collaboratorList = collaboratorsList.stream()
            .map(a -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", a.getId().toString());
                m.put("name", a.getName());
                m.put("spotifyId", a.getSpotifyId());
                return m;
            })
            .toList();

        List<Album> albums = albumJooqRepository.findByArtistId(artistId);
        List<Map<String, Object>> albumList = albums.stream()
            .map(a -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", a.getId().toString());
                m.put("title", a.getTitle());
                m.put("spotifyId", a.getSpotifyId());
                return m;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("artistId", artistId.toString());
        result.put("artistName", artist.getName());
        result.put("collaboratingArtists", collaboratorList);
        result.put("albums", albumList);
        return result;
    }

    @Transactional
    public Map<String, Object> rejectArtist(UUID artistId, String reason, boolean dryRun, boolean deleteContent) {
        Artist artist = artistJooqRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        // Get pending tracks for this artist
        List<Track> pendingTracks = trackJooqRepository.findByArtistId(artistId).stream()
            .filter(t -> "PENDING".equals(t.getProcessingStatus()))
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("artistId", artistId.toString());
        result.put("artistName", artist.getName());
        result.put("pendingTracksToDelete", pendingTracks.size());
        result.put("dryRun", dryRun);

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
                rejectionLogJooqRepository.insert(rejection);
            }

            // Delete pending tracks if requested
            if (deleteContent) {
                for (Track track : pendingTracks) {
                    // Delete track along with all non-cascading relations (artists, albums, playbacks, interactions)
                    trackJooqRepository.deleteWithRelations(track.getId());
                }
                result.put("deletedTracks", pendingTracks.size());
            }

            result.put("status", "success");
            result.put("message", "Artist rejected and added to blocklist");
        }

        return result;
    }

    @Transactional
    public Map<String, Object> approveArtist(UUID artistId) {
        Artist artist = artistJooqRepository.findById(artistId)
            .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        // Mark as verified
        artist.setIsVerified(true);
        artistJooqRepository.update(artist);

        // Queue pending tracks for analysis
        List<Track> pendingTracks = trackJooqRepository.findByArtistId(artistId).stream()
            .filter(t -> "PENDING".equals(t.getProcessingStatus()))
            .toList();

        for (Track track : pendingTracks) {
            taskDispatcher.dispatchAudioAnalysis(track.getId());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("artistId", artistId.toString());
        result.put("artistName", artist.getName());
        result.put("queuedTracks", pendingTracks.size());
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
                queuedTracks += (int) approvalResult.getOrDefault("queuedTracks", 0);
            } catch (Exception e) {
                failed.add(idStr + ": " + e.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("approved", approved);
        result.put("queuedTracks", queuedTracks);
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
                deletedTracks += (int) result.getOrDefault("deletedTracks", 0);
            } catch (Exception ignored) {}
        }

        // Reject albums
        for (String idStr : albumIds) {
            try {
                UUID id = UUID.fromString(idStr);
                Album album = albumJooqRepository.findById(id).orElse(null);
                if (album != null && album.getSpotifyId() != null) {
                    RejectionLog rejection = RejectionLog.builder()
                        .entityType("album")
                        .spotifyId(album.getSpotifyId())
                        .entityName(album.getTitle())
                        .reason(reason)
                        .deletedContent(true)
                        .build();
                    rejectionLogJooqRepository.insert(rejection);
                    rejectedAlbums++;
                }
            } catch (Exception ignored) {}
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("rejectedArtists", rejectedArtists);
        result.put("rejectedAlbums", rejectedAlbums);
        result.put("deletedTracks", deletedTracks);
        return result;
    }
}
