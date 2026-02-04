package se.dansbart.domain.admin.album;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogRepository;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumRepository;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminAlbumService {

    private final AlbumRepository albumRepository;
    private final TrackRepository trackRepository;
    private final RejectionLogRepository rejectionLogRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getAlbumsPaginated(String search, String artistId, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<Album> page;

        if (search != null && !search.isBlank()) {
            page = albumRepository.searchByTitle(search, pageable);
        } else if (artistId != null) {
            List<Album> albums = albumRepository.findByArtistId(UUID.fromString(artistId));
            // Simple pagination for filtered results
            int start = Math.min(offset, albums.size());
            int end = Math.min(offset + limit, albums.size());
            List<Album> pageContent = albums.subList(start, end);

            Map<String, Object> result = new HashMap<>();
            result.put("items", pageContent.stream().map(this::mapAlbumToAdmin).toList());
            result.put("total", albums.size());
            result.put("limit", limit);
            result.put("offset", offset);
            return result;
        } else {
            page = albumRepository.findAll(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .map(this::mapAlbumToAdmin)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private Map<String, Object> mapAlbumToAdmin(Album album) {
        long trackCount = album.getTrackLinks() != null ? album.getTrackLinks().size() : 0;
        long pendingCount = album.getTrackLinks() != null ?
            album.getTrackLinks().stream()
                .filter(tl -> tl.getTrack() != null && "PENDING".equals(tl.getTrack().getProcessingStatus()))
                .count() : 0;

        Map<String, Object> item = new HashMap<>();
        item.put("id", album.getId().toString());
        item.put("title", album.getTitle());
        item.put("spotify_id", album.getSpotifyId());
        item.put("cover_image_url", album.getCoverImageUrl());
        item.put("release_date", album.getReleaseDate());
        item.put("artist_id", album.getArtistId() != null ? album.getArtistId().toString() : null);
        item.put("track_count", trackCount);
        item.put("pending_count", pendingCount);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPendingAlbums(String artistId, int limit, int offset) {
        // Get albums that have pending tracks
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<Album> page;

        if (artistId != null) {
            List<Album> albums = albumRepository.findByArtistId(UUID.fromString(artistId));
            List<Album> pendingAlbums = albums.stream()
                .filter(a -> a.getTrackLinks() != null &&
                    a.getTrackLinks().stream().anyMatch(tl ->
                        tl.getTrack() != null && "PENDING".equals(tl.getTrack().getProcessingStatus())))
                .toList();

            int start = Math.min(offset, pendingAlbums.size());
            int end = Math.min(offset + limit, pendingAlbums.size());

            Map<String, Object> result = new HashMap<>();
            result.put("items", pendingAlbums.subList(start, end).stream().map(this::mapAlbumToAdmin).toList());
            result.put("total", pendingAlbums.size());
            result.put("limit", limit);
            result.put("offset", offset);
            return result;
        } else {
            page = albumRepository.findAll(pageable);
        }

        List<Map<String, Object>> items = page.getContent().stream()
            .filter(a -> a.getTrackLinks() != null &&
                a.getTrackLinks().stream().anyMatch(tl ->
                    tl.getTrack() != null && "PENDING".equals(tl.getTrack().getProcessingStatus())))
            .map(this::mapAlbumToAdmin)
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", items.size()); // Simplified - should use proper query
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    @Transactional
    public Map<String, Object> rejectAlbum(UUID albumId, String reason, boolean dryRun) {
        Album album = albumRepository.findById(albumId)
            .orElseThrow(() -> new IllegalArgumentException("Album not found"));

        // Get pending tracks
        List<Track> pendingTracks = album.getTrackLinks() != null ?
            album.getTrackLinks().stream()
                .map(TrackAlbum::getTrack)
                .filter(t -> t != null && "PENDING".equals(t.getProcessingStatus()))
                .toList() : List.of();

        Map<String, Object> result = new HashMap<>();
        result.put("album_id", albumId.toString());
        result.put("album_title", album.getTitle());
        result.put("pending_tracks_to_delete", pendingTracks.size());
        result.put("dry_run", dryRun);

        if (!dryRun) {
            // Add to blocklist if has spotify ID
            if (album.getSpotifyId() != null) {
                RejectionLog rejection = RejectionLog.builder()
                    .entityType("album")
                    .spotifyId(album.getSpotifyId())
                    .entityName(album.getTitle())
                    .reason(reason)
                    .deletedContent(true)
                    .build();
                rejectionLogRepository.save(rejection);
            }

            // Delete pending tracks
            for (Track track : pendingTracks) {
                trackRepository.delete(track);
            }

            result.put("status", "success");
            result.put("message", "Album rejected");
            result.put("deleted_tracks", pendingTracks.size());
        }

        return result;
    }
}
