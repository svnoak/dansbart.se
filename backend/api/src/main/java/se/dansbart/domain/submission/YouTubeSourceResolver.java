package se.dansbart.domain.submission;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.domain.submission.YouTubeClient.YouTubeFeed;
import se.dansbart.domain.submission.YouTubeClient.YouTubeVideo;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.List;

/** Turns a YouTube link into the tracks behind it. */
@Component
@RequiredArgsConstructor
public class YouTubeSourceResolver {

    private final YouTubeClient youtube;

    public ResolvedSource resolve(MusicLink link) {
        return switch (link.kind()) {
            case TRACK -> {
                YouTubeVideo video = youtube.getVideo(link.id())
                    .orElseThrow(() -> new ResourceNotFoundException("YouTube video not found: " + link.id()));
                yield new ResolvedSource(link, null, List.of(toCandidate(video)), false);
            }
            case PLAYLIST -> feed(link, youtube.getPlaylistFeed(link.id())
                .orElseThrow(() -> new ResourceNotFoundException("YouTube playlist not found: " + link.id())));
            case CHANNEL -> feed(link, youtube.getChannelFeed(link.id())
                .orElseThrow(() -> new ResourceNotFoundException("YouTube channel not found: " + link.id())));
            case ALBUM, ARTIST -> throw new ResourceNotFoundException("YouTube has no albums or artists");
        };
    }

    /** The feed only carries the newest videos, so a longer list is reported as cut. */
    private static ResolvedSource feed(MusicLink link, YouTubeFeed feed) {
        List<SubmissionCandidate> tracks = feed.videos().stream().map(YouTubeSourceResolver::toCandidate).toList();
        return new ResolvedSource(link, feed.title(), tracks, tracks.size() >= YouTubeClient.FEED_LIMIT);
    }

    private static SubmissionCandidate toCandidate(YouTubeVideo video) {
        YouTubeTitleParser.ParsedTitle parsed = YouTubeTitleParser.parse(video.title(), video.channelTitle());
        return new SubmissionCandidate(MusicLink.Provider.YOUTUBE, video.id(), parsed.title(), parsed.artist(), null);
    }
}
