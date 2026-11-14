package se.dansbart.domain.spotify;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyAlbumRef;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyArtistRef;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyImportAlbum;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyImportTrack;
import se.dansbart.domain.track.LinkedTrackCreator;
import se.dansbart.domain.track.LinkedTrackCreator.ArtistRef;
import se.dansbart.domain.track.PlaybackLink;
import se.dansbart.domain.track.PlaybackLinkJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.exception.UnprocessableEntityException;
import se.dansbart.voter.VoterContext;
import se.dansbart.worker.TaskDispatcher;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Imports tracks from Spotify into the library. The API reads Spotify and creates the
 * artists, albums, tracks and Spotify links itself; the workers only analyse. Each new
 * track is sent to the audio analysis, which finds a matching YouTube video, links it
 * and analyses its audio.
 *
 * A track the library already has, by its Spotify link or its ISRC, is not created
 * again. The importing admin is recorded as uploader, so the tracks are listed at once,
 * before their analysis. Each album is saved in its own transaction, so a large artist
 * import keeps what it managed when one album fails.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpotifyImportService {

    private final SpotifyHttpClient spotify;
    private final LinkedTrackCreator trackCreator;
    private final TrackJooqRepository trackRepository;
    private final PlaybackLinkJooqRepository playbackLinkRepository;
    private final AlbumJooqRepository albumRepository;
    private final TaskDispatcher taskDispatcher;
    private final VoterContext voterContext;
    private final TransactionTemplate transactionTemplate;

    /** What an import did. */
    public record ImportResult(int created, int existing, int failedAlbums, List<UUID> createdTrackIds) {

        static ImportResult empty() {
            return new ImportResult(0, 0, 0, List.of());
        }

        ImportResult plus(ImportResult other) {
            List<UUID> ids = new ArrayList<>(createdTrackIds);
            ids.addAll(other.createdTrackIds);
            return new ImportResult(created + other.created, existing + other.existing,
                failedAlbums + other.failedAlbums, ids);
        }

        /** The response body of the import endpoints. */
        public Map<String, Object> toResponse() {
            Map<String, Object> body = new HashMap<>();
            body.put("status", "done");
            body.put("created", created);
            body.put("existing", existing);
            body.put("failedAlbums", failedAlbums);
            body.put("trackIds", createdTrackIds);
            return body;
        }
    }

    public ImportResult importTrack(String spotifyTrackId) {
        SpotifyImportTrack track = read(() -> spotify.getTrackForImport(spotifyTrackId), "Låten");
        return save(List.of(track));
    }

    public ImportResult importAlbum(String spotifyAlbumId) {
        SpotifyImportAlbum album = read(() -> spotify.getAlbumForImport(spotifyAlbumId), "Albumet");
        return save(album.tracks());
    }

    public ImportResult importPlaylist(String spotifyPlaylistId) {
        List<SpotifyImportTrack> tracks = read(() -> spotify.getPlaylistTracksForImport(spotifyPlaylistId), "Spellistan");
        return save(tracks);
    }

    /** Imports every album and single of the artist. An album that fails is counted and skipped. */
    public ImportResult importArtist(String spotifyArtistId) {
        List<SpotifyHttpClient.SpotifyAlbum> albums = read(() -> spotify.getArtistAlbums(spotifyArtistId), "Artisten");
        ImportResult total = ImportResult.empty();
        for (SpotifyHttpClient.SpotifyAlbum album : albums) {
            try {
                total = total.plus(importAlbum(album.id()));
            } catch (RuntimeException e) {
                log.warn("Import of album {} of artist {} failed: {}", album.id(), spotifyArtistId, e.getMessage());
                total = total.plus(new ImportResult(0, 0, 1, List.of()));
            }
        }
        return total;
    }

    // ---------------------------------------------------------------- saving

    /** Saves the tracks in one transaction and then starts the analysis of the new ones. */
    private ImportResult save(List<SpotifyImportTrack> tracks) {
        UUID uploaderId = voterContext.getUserId();
        ImportResult result = transactionTemplate.execute(tx -> {
            int existing = 0;
            List<UUID> created = new ArrayList<>();
            for (SpotifyImportTrack track : tracks) {
                if (track.name() == null || track.name().isBlank()) continue;
                Optional<UUID> newId = saveTrack(track, uploaderId);
                if (newId.isPresent()) created.add(newId.get());
                else existing++;
            }
            return new ImportResult(created.size(), existing, 0, created);
        });
        // After the commit, so the audio worker finds the tracks.
        result.createdTrackIds().forEach(taskDispatcher::dispatchAudioAnalysis);
        return result;
    }

    /** @return the id of the new track, or empty when the library already had it */
    private Optional<UUID> saveTrack(SpotifyImportTrack track, UUID uploaderId) {
        UUID albumId = track.album() != null ? findOrCreateAlbum(track.album()) : null;

        Optional<UUID> existing = findExisting(track);
        if (existing.isPresent()) {
            UUID trackId = existing.get();
            if (playbackLinkRepository.findTrackIdByPlatformAndExternalId("spotify", track.id()).isEmpty()) {
                PlaybackLink link = new PlaybackLink();
                link.setTrackId(trackId);
                link.setPlatform("spotify");
                link.setDeepLink(track.id());
                link.setIsWorking(true);
                playbackLinkRepository.insert(link);
            }
            if (albumId != null && !albumRepository.hasTrack(albumId, trackId)) {
                albumRepository.insertTrackAlbum(trackId, albumId);
            }
            return Optional.empty();
        }

        List<ArtistRef> artists = track.artists().stream()
            .map(a -> new ArtistRef(a.name(), a.id()))
            .toList();
        return Optional.of(trackCreator.create("spotify", track.id(), track.name(), artists,
            track.durationMs(), track.isrc(), albumId, uploaderId));
    }

    private Optional<UUID> findExisting(SpotifyImportTrack track) {
        Optional<UUID> bySpotifyLink = playbackLinkRepository.findTrackIdByPlatformAndExternalId("spotify", track.id());
        if (bySpotifyLink.isPresent()) return bySpotifyLink;
        if (track.isrc() != null) {
            return trackRepository.findByIsrc(track.isrc()).stream().findFirst().map(Track::getId);
        }
        return Optional.empty();
    }

    private UUID findOrCreateAlbum(SpotifyAlbumRef ref) {
        if (ref.id() == null || ref.name() == null) return null;
        return albumRepository.findBySpotifyId(ref.id()).map(Album::getId).orElseGet(() -> {
            Album album = new Album();
            album.setTitle(ref.name());
            album.setCoverImageUrl(ref.coverUrl());
            album.setReleaseDate(ref.releaseDate());
            album.setSpotifyId(ref.id());
            if (!ref.artists().isEmpty()) {
                SpotifyArtistRef first = ref.artists().get(0);
                Artist artist = trackCreator.findOrCreateArtist(new ArtistRef(first.name(), first.id()));
                album.setArtistId(artist.getId());
            }
            return albumRepository.insert(album).getId();
        });
    }

    // ---------------------------------------------------------------- reading

    /**
     * Reads from Spotify and turns its failures into messages for the admin: a missing
     * resource is a 404, any other failure says that Spotify could not be reached.
     */
    private <T> T read(Supplier<T> call, String what) {
        T value;
        try {
            value = call.get();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 400 || status == 404) {
                throw new ResourceNotFoundException(what + " finns inte på Spotify.");
            }
            log.warn("Spotify answered {} for an import: {}", status, e.getMessage());
            throw new UnprocessableEntityException(
                "Spotify svarade med fel " + status + ". Försök igen om en stund.");
        } catch (SpotifyHttpClient.SpotifyUnavailableException | RestClientException e) {
            log.warn("Spotify could not be reached for an import: {}", e.getMessage());
            throw new UnprocessableEntityException("Det gick inte att nå Spotify. Försök igen om en stund.");
        }
        if (value == null) {
            throw new ResourceNotFoundException(what + " finns inte på Spotify.");
        }
        return value;
    }
}
