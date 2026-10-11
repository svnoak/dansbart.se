package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.submission.MusicLink.Provider;
import se.dansbart.domain.submission.MusicLink.SourceKind;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class YouTubeSourceResolverTest {

    @Mock
    private YouTubeClient youtube;

    @Test
    void videoBecomesOneCandidateWithArtistFromTitle() {
        when(youtube.getVideo("dQw4w9WgXcQ")).thenReturn(Optional.of(
            new YouTubeClient.YouTubeVideo("dQw4w9WgXcQ", "Väsen - Josefins dopvals", "Någon")));
        MusicLink link = new MusicLink(Provider.YOUTUBE, SourceKind.TRACK, "dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ");

        ResolvedSource source = new YouTubeSourceResolver(youtube).resolve(link);

        assertThat(source.sourceName()).isNull();
        SubmissionCandidate c = source.tracks().get(0);
        assertThat(c.provider()).isEqualTo(Provider.YOUTUBE);
        assertThat(c.externalId()).isEqualTo("dQw4w9WgXcQ");
        assertThat(c.artistName()).isEqualTo("Väsen");
        assertThat(c.title()).isEqualTo("Josefins dopvals");
    }

    @Test
    void missingVideoIsNotFound() {
        when(youtube.getVideo("dQw4w9WgXcQ")).thenReturn(Optional.empty());
        MusicLink link = new MusicLink(Provider.YOUTUBE, SourceKind.TRACK, "dQw4w9WgXcQ", "u");

        assertThatThrownBy(() -> new YouTubeSourceResolver(youtube).resolve(link))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void playlistListsTheFeedAndUsesTheChannelAsArtist() {
        when(youtube.getPlaylistFeed("PL123")).thenReturn(Optional.of(new YouTubeClient.YouTubeFeed("Polskor", List.of(
            new YouTubeClient.YouTubeVideo("aaaaaaaaaaa", "Polska 1", "Kanal"),
            new YouTubeClient.YouTubeVideo("bbbbbbbbbbb", "Polska 2", "Kanal")))));
        MusicLink link = new MusicLink(Provider.YOUTUBE, SourceKind.PLAYLIST, "PL123", "u");

        ResolvedSource source = new YouTubeSourceResolver(youtube).resolve(link);

        assertThat(source.sourceName()).isEqualTo("Polskor");
        assertThat(source.truncated()).isFalse();
        assertThat(source.tracks()).extracting(SubmissionCandidate::title).containsExactly("Polska 1", "Polska 2");
        assertThat(source.tracks().get(0).artistName()).isEqualTo("Kanal");
    }
}
