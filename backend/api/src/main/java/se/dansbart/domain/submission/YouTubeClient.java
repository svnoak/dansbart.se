package se.dansbart.domain.submission;

import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import se.dansbart.exception.ExternalServiceException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads public YouTube metadata without an API key: a video through the oEmbed
 * endpoint, a playlist or channel through the public Atom feed, which lists the
 * newest {@value #FEED_LIMIT} videos.
 */
@Component
public class YouTubeClient {

    public static final int FEED_LIMIT = 15;

    public record YouTubeVideo(String id, String title, String channelTitle) {}
    public record YouTubeFeed(String title, List<YouTubeVideo> videos) {}

    private static final String BASE_URL = "https://www.youtube.com";
    private static final Pattern CHANNEL_ID_IN_PAGE = Pattern.compile("\"(?:externalId|channelId)\":\"(UC[A-Za-z0-9_-]{22})\"");

    private final RestClient client;

    public YouTubeClient() {
        this(RestClient.builder().baseUrl(BASE_URL).build());
    }

    YouTubeClient(RestClient client) {
        this.client = client;
    }

    public Optional<YouTubeVideo> getVideo(String videoId) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = client.get()
                .uri(uri -> uri.path("/oembed")
                    .queryParam("url", "https://www.youtube.com/watch?v=" + videoId)
                    .queryParam("format", "json").build())
                .retrieve()
                .body(Map.class);
            if (body == null || !(body.get("title") instanceof String title)) return Optional.empty();
            return Optional.of(new YouTubeVideo(videoId, title, (String) body.get("author_name")));
        } catch (HttpClientErrorException e) {
            // 400/401/403/404 for unknown, private or embed-restricted videos
            return Optional.empty();
        } catch (RestClientException e) {
            throw new ExternalServiceException("YouTube request failed", e);
        }
    }

    public Optional<YouTubeFeed> getPlaylistFeed(String playlistId) {
        return getFeed("playlist_id", playlistId);
    }

    /** A channel by id ("UC...") or handle ("@name"). */
    public Optional<YouTubeFeed> getChannelFeed(String idOrHandle) {
        String channelId = idOrHandle.startsWith("@") ? resolveHandle(idOrHandle).orElse(null) : idOrHandle;
        if (channelId == null) return Optional.empty();
        return getFeed("channel_id", channelId);
    }

    private Optional<String> resolveHandle(String handle) {
        String page = getText("/" + handle);
        if (page == null) return Optional.empty();
        Matcher m = CHANNEL_ID_IN_PAGE.matcher(page);
        return m.find() ? Optional.of(m.group(1)) : Optional.empty();
    }

    private Optional<YouTubeFeed> getFeed(String param, String value) {
        String xml = getText("/feeds/videos.xml?" + param + "=" + value);
        if (xml == null || xml.isBlank()) return Optional.empty();
        return Optional.of(parseFeed(xml));
    }

    private String getText(String path) {
        try {
            byte[] bytes = client.get().uri(path).retrieve().body(byte[].class);
            return bytes == null ? null : new String(bytes, StandardCharsets.UTF_8);
        } catch (HttpClientErrorException e) {
            return null;
        } catch (RestClientException e) {
            throw new ExternalServiceException("YouTube request failed", e);
        }
    }

    static YouTubeFeed parseFeed(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document doc = factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            String feedTitle = firstText(doc.getDocumentElement(), "title");
            List<YouTubeVideo> videos = new ArrayList<>();
            NodeList entries = doc.getElementsByTagName("entry");
            for (int i = 0; i < entries.getLength(); i++) {
                Element entry = (Element) entries.item(i);
                String id = firstText(entry, "yt:videoId");
                if (id == null) continue;
                Element author = (Element) entry.getElementsByTagName("author").item(0);
                String channel = author != null ? firstText(author, "name") : null;
                videos.add(new YouTubeVideo(id, firstText(entry, "title"), channel));
            }
            return new YouTubeFeed(feedTitle, videos);
        } catch (Exception e) {
            throw new ExternalServiceException("YouTube feed could not be read", e);
        }
    }

    /** Text of the first direct child with this tag name, or null. */
    private static String firstText(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i).getParentNode() == parent) return nodes.item(i).getTextContent();
        }
        return null;
    }
}
