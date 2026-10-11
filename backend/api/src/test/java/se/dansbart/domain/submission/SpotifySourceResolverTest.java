package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.spotify.SpotifyHttpClient;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyAlbum;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyTrack;
import se.dansbart.domain.submission.MusicLink.Provider;
import se.dansbart.domain.submission.MusicLink.SourceKind;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SpotifySourceResolverTest {

    @Mock
    private SpotifyHttpClient spotify;

    @Test
    void singleTrackCarriesArtistAndAlbum() {
        when(spotify.getTrack("t1")).thenReturn(Optional.of(new SpotifyTrack("t1", "Polska efter Pekkos Per", "Väsen", "Trio")));
        MusicLink link = new MusicLink(Provider.SPOTIFY, SourceKind.TRACK, "t1", "u");

        ResolvedSource source = new SpotifySourceResolver(spotify).resolve(link, 300);

        SubmissionCandidate c = source.tracks().get(0);
        assertThat(c.externalId()).isEqualTo("t1");
        assertThat(c.artistName()).isEqualTo("Väsen");
        assertThat(c.albumName()).isEqualTo("Trio");
    }

    @Test
    void albumListsItsTracksInOrderAndNamesTheSource() {
        when(spotify.getAlbum("alb1")).thenReturn(Optional.of(new SpotifyAlbum("alb1", "Trio", 2)));
        when(spotify.getAlbumTracks("alb1")).thenReturn(List.of(new SpotifyTrack("t1", "A", "Väsen", null), new SpotifyTrack("t2", "B", "Väsen", null)));
        MusicLink link = new MusicLink(Provider.SPOTIFY, SourceKind.ALBUM, "alb1", "u");

        ResolvedSource source = new SpotifySourceResolver(spotify).resolve(link, 300);

        assertThat(source.sourceName()).isEqualTo("Trio");
        assertThat(source.truncated()).isFalse();
        assertThat(source.tracks()).extracting(SubmissionCandidate::title).containsExactly("A", "B");
        assertThat(source.tracks().get(0).albumName()).isEqualTo("Trio");
    }

    @Test
    void artistWalksAlbumsUntilTheCap() {
        when(spotify.getArtistName("art1")).thenReturn(Optional.of("Väsen"));
        when(spotify.getArtistAlbums("art1")).thenReturn(List.of(new SpotifyAlbum("a1", "One", 2), new SpotifyAlbum("a2", "Two", 1)));
        when(spotify.getAlbumTracks("a1")).thenReturn(List.of(new SpotifyTrack("t1", "A"), new SpotifyTrack("t2", "B")));
        when(spotify.getAlbumTracks("a2")).thenReturn(List.of(new SpotifyTrack("t3", "C")));
        MusicLink link = new MusicLink(Provider.SPOTIFY, SourceKind.ARTIST, "art1", "u");

        ResolvedSource source = new SpotifySourceResolver(spotify).resolve(link, 2);

        assertThat(source.sourceName()).isEqualTo("Väsen");
        assertThat(source.truncated()).isTrue();
        assertThat(source.tracks()).hasSize(2);
        assertThat(source.tracks().get(0).albumName()).isEqualTo("One");
    }

    @Test
    void unknownPlaylistIsNotFound() {
        when(spotify.getPlaylistName("p1")).thenReturn(Optional.empty());
        MusicLink link = new MusicLink(Provider.SPOTIFY, SourceKind.PLAYLIST, "p1", "u");

        assertThatThrownBy(() -> new SpotifySourceResolver(spotify).resolve(link, 300))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
