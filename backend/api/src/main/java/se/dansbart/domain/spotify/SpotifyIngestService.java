package se.dansbart.domain.spotify;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import se.dansbart.domain.track.LinkedTrackCreator;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.voter.VoterContext;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

/**
 * Service for Spotify preview and ingestion operations.
 * Previews fetch data directly from the Spotify API synchronously.
 * A single track is created by the API itself; albums, artists and playlists are
 * ingested by the feature worker.
 *
 * Not admin-specific — used by both the admin ingest UI and, once wired up, a
 * self-serve authenticated-user ingest endpoint. Moved out of the `domain.admin`
 * package for that reason (previously `AdminSpotifyService`).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpotifyIngestService {

    private final TaskDispatcher taskDispatcher;
    private final SpotifyHttpClient spotifyHttpClient;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final LinkedTrackCreator linkedTrackCreator;
    private final VoterContext voterContext;

    /**
     * Preview an artist's albums directly from Spotify.
     * Returns album metadata without ingesting any tracks.
     */
    public List<Map<String, Object>> getArtistAlbums(String spotifyArtistId) {
        List<SpotifyHttpClient.SpotifyAlbum> albums = spotifyHttpClient.getArtistAlbums(spotifyArtistId);
        return albums.stream().map(a -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", a.id());
            item.put("name", a.name());
            item.put("totalTracks", a.totalTracks());
            return item;
        }).toList();
    }

    /**
     * Preview an album's tracks directly from Spotify.
     * Returns track metadata without ingesting them.
     */
    public List<Map<String, Object>> getAlbumTracks(String spotifyAlbumId) {
        List<SpotifyHttpClient.SpotifyTrack> tracks = spotifyHttpClient.getAlbumTracks(spotifyAlbumId);
        return tracks.stream().map(t -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", t.id());
            item.put("name", t.name());
            return item;
        }).toList();
    }

    /**
     * Ingest an album from Spotify.
     * Queues all tracks from the album for full processing.
     */
    public Map<String, Object> ingestAlbum(String spotifyAlbumId) {
        taskDispatcher.dispatchSpotifyIngest("album", spotifyAlbumId);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("spotifyAlbumId", spotifyAlbumId);
        result.put("message", "Album ingestion queued");
        return result;
    }

    /**
     * Imports a single track from Spotify.
     *
     * The track is created here, with the details the API reads from Spotify, and the
     * audio analysis is dispatched directly, so an import does not depend on the feature
     * worker. A track the library already has is left as it is. Only when the API cannot
     * read the track from Spotify is the import handed to the feature worker.
     */
    @Transactional
    public Map<String, Object> ingestTrack(String spotifyTrackId) {
        Map<String, Object> result = new HashMap<>();
        result.put("spotifyTrackId", spotifyTrackId);

        Optional<UUID> existing = playbackLinkRepository.findTrackIdByPlatformAndExternalId("spotify", spotifyTrackId);
        if (existing.isPresent()) {
            result.put("status", "exists");
            result.put("trackId", existing.get());
            result.put("message", "Track is already in the library");
            return result;
        }

        SpotifyHttpClient.SpotifyTrackDetails details;
        try {
            details = spotifyHttpClient.getTrack(spotifyTrackId);
        } catch (RuntimeException e) {
            log.warn("Spotify lookup for track {} failed, handing the import to the worker: {}",
                spotifyTrackId, e.getMessage());
            details = null;
        }
        if (details == null || details.name() == null || details.name().isBlank()) {
            taskDispatcher.dispatchSpotifyIngest("track", spotifyTrackId);
            result.put("status", "queued");
            result.put("message", "Track ingestion queued");
            return result;
        }

        String artistName = details.artistNames().isEmpty() ? null : details.artistNames().get(0);
        UUID trackId = linkedTrackCreator.create("spotify", spotifyTrackId, details.name(), artistName,
            details.durationMs(), details.isrc(), voterContext.getUserId());
        afterCommit(() -> taskDispatcher.dispatchAudioAnalysis(trackId));

        result.put("status", "created");
        result.put("trackId", trackId);
        result.put("message", "Track created and queued for analysis");
        return result;
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
