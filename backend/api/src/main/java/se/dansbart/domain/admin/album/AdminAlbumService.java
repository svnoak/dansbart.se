package se.dansbart.domain.admin.album;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.RejectionLog;
import se.dansbart.domain.admin.RejectionLogJooqRepository;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminAlbumService {

    private final AlbumJooqRepository albumJooqRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final RejectionLogJooqRepository rejectionLogJooqRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getAlbumsPaginated(String search, String artistId, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        Page<Album> page;
        List<Album> pageContent;

        if (search != null && !search.isBlank()) {
            page = albumJooqRepository.searchByTitle(search, pageable);
            pageContent = page.getContent();
        } else if (artistId != null) {
            List<Album> albums = albumJooqRepository.findByArtistId(UUID.fromString(artistId));
            int start = Math.min(offset, albums.size());
            int end = Math.min(offset + limit, albums.size());
            pageContent = albums.subList(start, end);
            Map<String, Object> result = new HashMap<>();
            result.put("items", mapAlbumsToAdmin(pageContent));
            result.put("total", albums.size());
            result.put("limit", limit);
            result.put("offset", offset);
            return result;
        } else {
            page = albumJooqRepository.findAll(pageable);
            pageContent = page.getContent();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("items", mapAlbumsToAdmin(pageContent));
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    private List<Map<String, Object>> mapAlbumsToAdmin(List<Album> albums) {
        if (albums.isEmpty()) return List.of();
        List<UUID> albumIds = albums.stream().map(Album::getId).toList();
        Map<UUID, Long> pendingByAlbum = new HashMap<>();
        for (Object[] row : albumJooqRepository.countPendingTracksByAlbumIds(albumIds)) {
            UUID id = row[0] instanceof UUID ? (UUID) row[0] : UUID.fromString(row[0].toString());
            long count = ((Number) row[1]).longValue();
            pendingByAlbum.put(id, count);
        }
        Map<UUID, Long> trackCountByAlbum = albumJooqRepository.findTrackCountByAlbumIds(albumIds);
        return albums.stream()
            .map(a -> mapAlbumToAdmin(a, pendingByAlbum.getOrDefault(a.getId(), 0L), trackCountByAlbum.getOrDefault(a.getId(), 0L)))
            .toList();
    }

    private Map<String, Object> mapAlbumToAdmin(Album album, long pendingCount, long trackCount) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", album.getId().toString());
        item.put("title", album.getTitle());
        item.put("spotifyId", album.getSpotifyId());
        item.put("coverImageUrl", album.getCoverImageUrl());
        item.put("releaseDate", album.getReleaseDate());
        item.put("artistId", album.getArtistId() != null ? album.getArtistId().toString() : null);
        item.put("trackCount", trackCount);
        item.put("pendingCount", pendingCount);
        return item;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPendingAlbums(String artistId, int limit, int offset) {
        PageRequest pageable = PageRequest.of(offset / limit, limit);
        List<Album> candidates;
        long total;

        if (artistId != null) {
            List<Album> albums = albumJooqRepository.findByArtistId(UUID.fromString(artistId));
            if (albums.isEmpty()) {
                return resultMap(List.of(), 0, limit, offset);
            }
            Map<UUID, Long> pendingByAlbum = pendingCountsByAlbumId(albums.stream().map(Album::getId).toList());
            List<Album> pendingAlbums = albums.stream()
                .filter(a -> pendingByAlbum.getOrDefault(a.getId(), 0L) > 0)
                .toList();
            total = pendingAlbums.size();
            int start = Math.min(offset, pendingAlbums.size());
            int end = Math.min(offset + limit, pendingAlbums.size());
            candidates = pendingAlbums.subList(start, end);
        } else {
            Page<Album> page = albumJooqRepository.findAll(pageable);
            candidates = page.getContent();
            if (candidates.isEmpty()) {
                return resultMap(List.of(), 0, limit, offset);
            }
            Map<UUID, Long> pendingByAlbum = pendingCountsByAlbumId(candidates.stream().map(Album::getId).toList());
            Map<UUID, Long> trackCountByAlbum = albumJooqRepository.findTrackCountByAlbumIds(candidates.stream().map(Album::getId).toList());
            List<Map<String, Object>> items = candidates.stream()
                .filter(a -> pendingByAlbum.getOrDefault(a.getId(), 0L) > 0)
                .map(a -> mapAlbumToAdmin(a, pendingByAlbum.getOrDefault(a.getId(), 0L), trackCountByAlbum.getOrDefault(a.getId(), 0L)))
                .toList();
            return resultMap(items, items.size(), limit, offset);
        }

        return resultMap(mapAlbumsToAdmin(candidates), total, limit, offset);
    }

    private Map<UUID, Long> pendingCountsByAlbumId(List<UUID> albumIds) {
        Map<UUID, Long> out = new HashMap<>();
        for (Object[] row : albumJooqRepository.countPendingTracksByAlbumIds(albumIds)) {
            UUID id = row[0] instanceof UUID ? (UUID) row[0] : UUID.fromString(row[0].toString());
            out.put(id, ((Number) row[1]).longValue());
        }
        return out;
    }

    private static Map<String, Object> resultMap(List<?> items, long total, int limit, int offset) {
        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", total);
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    @Transactional
    public Map<String, Object> rejectAlbum(UUID albumId, String reason, boolean dryRun) {
        Album album = albumJooqRepository.findById(albumId)
            .orElseThrow(() -> new IllegalArgumentException("Album not found"));

        // Get pending tracks for this album
        List<Track> pendingTracks = trackJooqRepository.findByAlbumId(albumId).stream()
            .filter(t -> "PENDING".equals(t.getProcessingStatus()))
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("albumId", albumId.toString());
        result.put("albumTitle", album.getTitle());
        result.put("pendingTracksToDelete", pendingTracks.size());
        result.put("dryRun", dryRun);

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
                rejectionLogJooqRepository.insert(rejection);
            }

            // Delete pending tracks
            for (Track track : pendingTracks) {
                trackJooqRepository.deleteById(track.getId());
            }

            result.put("status", "success");
            result.put("message", "Album rejected");
            result.put("deletedTracks", pendingTracks.size());
        }

        return result;
    }
}
