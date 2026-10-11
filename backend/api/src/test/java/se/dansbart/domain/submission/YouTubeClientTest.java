package se.dansbart.domain.submission;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import se.dansbart.exception.ExternalServiceException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class YouTubeClientTest {

    private static final String FEED = """
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
          <title>Polskor</title>
          <entry><yt:videoId>aaaaaaaaaaa</yt:videoId><title>Väsen - Polska 1</title><author><name>Kanal</name></author></entry>
          <entry><yt:videoId>bbbbbbbbbbb</yt:videoId><title>Polska 2</title><author><name>Kanal</name></author></entry>
        </feed>
        """;

    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://www.youtube.com");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    private YouTubeClient client() {
        return new YouTubeClient(builder.build());
    }

    @Test
    void videoComesFromOembed() {
        server.expect(requestTo(startsWith("https://www.youtube.com/oembed?url=")))
            .andRespond(withSuccess("{\"title\":\"Väsen - Josefins dopvals\",\"author_name\":\"Väsen - Topic\"}",
                MediaType.APPLICATION_JSON));

        Optional<YouTubeClient.YouTubeVideo> video = client().getVideo("dQw4w9WgXcQ");

        assertThat(video).isPresent();
        assertThat(video.get().title()).isEqualTo("Väsen - Josefins dopvals");
        assertThat(video.get().channelTitle()).isEqualTo("Väsen - Topic");
    }

    @Test
    void unknownVideoIsEmpty() {
        server.expect(requestTo(startsWith("https://www.youtube.com/oembed"))).andRespond(withStatus(NOT_FOUND));

        assertThat(client().getVideo("dQw4w9WgXcQ")).isEmpty();
    }

    @Test
    void outageIsAnExternalServiceError() {
        server.expect(requestTo(startsWith("https://www.youtube.com/oembed"))).andRespond(withServerError());

        assertThatThrownBy(() -> client().getVideo("dQw4w9WgXcQ")).isInstanceOf(ExternalServiceException.class);
    }

    @Test
    void playlistComesFromThePublicFeed() {
        server.expect(requestTo("https://www.youtube.com/feeds/videos.xml?playlist_id=PL123"))
            .andRespond(withSuccess(FEED, MediaType.APPLICATION_ATOM_XML));

        Optional<YouTubeClient.YouTubeFeed> feed = client().getPlaylistFeed("PL123");

        assertThat(feed).isPresent();
        assertThat(feed.get().title()).isEqualTo("Polskor");
        assertThat(feed.get().videos()).extracting(YouTubeClient.YouTubeVideo::id)
            .containsExactly("aaaaaaaaaaa", "bbbbbbbbbbb");
        assertThat(feed.get().videos().get(0).title()).isEqualTo("Väsen - Polska 1");
        assertThat(feed.get().videos().get(0).channelTitle()).isEqualTo("Kanal");
    }

    @Test
    void handleIsResolvedFromTheChannelPage() {
        server.expect(requestTo("https://www.youtube.com/@folk"))
            .andRespond(withSuccess("<html>...\"externalId\":\"UCuAXFkgsw1L7xaCfnd5JJOw\"...</html>", MediaType.TEXT_HTML));
        server.expect(requestTo("https://www.youtube.com/feeds/videos.xml?channel_id=UCuAXFkgsw1L7xaCfnd5JJOw"))
            .andRespond(withSuccess(FEED, MediaType.APPLICATION_ATOM_XML));

        Optional<YouTubeClient.YouTubeFeed> feed = client().getChannelFeed("@folk");

        assertThat(feed).isPresent();
        assertThat(feed.get().videos()).hasSize(2);
    }

    @Test
    void missingPlaylistIsEmpty() {
        server.expect(requestTo(startsWith("https://www.youtube.com/feeds/videos.xml"))).andRespond(withStatus(NOT_FOUND));

        assertThat(client().getPlaylistFeed("PL404")).isEmpty();
    }
}
