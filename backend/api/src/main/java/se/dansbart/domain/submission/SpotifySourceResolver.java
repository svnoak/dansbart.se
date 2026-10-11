package se.dansbart.domain.submission;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.domain.spotify.SpotifyHttpClient;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyAlbum;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyTrack;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.ArrayList;
import java.util.List;

/** Turns a Spotify link into the tracks behind it. The ingest worker fetches the rest later. */
@Component
@RequiredArgsConstructor
public class SpotifySourceResolver {

    private final SpotifyHttpClient spotify;

    public ResolvedSource resolve(MusicLink link, int maxTracks) {
        return switch (link.kind()) {
            case TRACK -> {
                SpotifyTrack track = spotify.getTrack(link.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Spotify track not found: " + link.id()));
                yield new ResolvedSource(link, null, List.of(toCandidate(track, null)), false);
            }
            case ALBUM -> {
                SpotifyAlbum album = spotify.getAlbum(link.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Spotify album not found: " + link.id()));
                List<SpotifyTrack> tracks = spotify.getAlbumTracks(link.id());
                yield new ResolvedSource(link, album.name(), capped(tracks, album.name(), maxTracks), tracks.size() > maxTracks);
            }
            case PLAYLIST -> {
                String name = spotify.getPlaylistName(link.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Spotify playlist not found: " + link.id()));
                List<SpotifyTrack> tracks = spotify.getPlaylistTracks(link.id(), maxTracks + 1);
                yield new ResolvedSource(link, name, capped(tracks, null, maxTracks), tracks.size() > maxTracks);
            }
            case ARTIST -> {
                String name = spotify.getArtistName(link.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Spotify artist not found: " + link.id()));
                List<SubmissionCandidate> out = new ArrayList<>();
                boolean truncated = false;
                for (SpotifyAlbum album : spotify.getArtistAlbums(link.id())) {
                    for (SpotifyTrack track : spotify.getAlbumTracks(album.id())) {
                        if (out.size() >= maxTracks) {
                            truncated = true;
                            break;
                        }
                        out.add(toCandidate(track, album.name()));
                    }
                    if (truncated) break;
                }
                yield new ResolvedSource(link, name, out, truncated);
            }
            case CHANNEL -> throw new ResourceNotFoundException("Spotify has no channels");
        };
    }

    private static List<SubmissionCandidate> capped(List<SpotifyTrack> tracks, String albumName, int max) {
        return tracks.stream().limit(max).map(t -> toCandidate(t, albumName)).toList();
    }

    private static SubmissionCandidate toCandidate(SpotifyTrack t, String albumName) {
        return new SubmissionCandidate(MusicLink.Provider.SPOTIFY, t.id(), t.name(), t.artistName(),
            t.albumName() != null ? t.albumName() : albumName);
    }
}
