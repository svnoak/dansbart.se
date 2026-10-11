package se.dansbart.domain.submission;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.domain.admin.StyleKeyword;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Suggests a dance style from a track title, and failing that from its album title,
 * using the same admin-maintained {@code style_keywords} the workers match on. Longest
 * keyword wins ("slängpolska" before "polska"), matched on word boundaries so
 * "polskan" still matches "polska" but "schottis" does not match "schott".
 */
@Component
@RequiredArgsConstructor
public class StyleSuggester {

    public record Suggestion(String mainStyle, String subStyle) {}

    private record CompiledKeyword(Pattern pattern, String mainStyle, String subStyle) {}

    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private final StyleKeywordJooqRepository keywordRepository;

    private volatile List<CompiledKeyword> cached = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    public Optional<Suggestion> suggest(String title, String albumName) {
        List<CompiledKeyword> keywords = keywords();
        return match(keywords, title).or(() -> match(keywords, albumName));
    }

    private Optional<Suggestion> match(List<CompiledKeyword> keywords, String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String haystack = text.toLowerCase(Locale.ROOT);
        for (CompiledKeyword keyword : keywords) {
            if (keyword.pattern().matcher(haystack).find()) {
                return Optional.of(new Suggestion(keyword.mainStyle(), keyword.subStyle()));
            }
        }
        return Optional.empty();
    }

    private List<CompiledKeyword> keywords() {
        if (Instant.now().isBefore(cachedAt.plus(CACHE_TTL))) {
            return cached;
        }
        List<CompiledKeyword> compiled = keywordRepository.findByIsActiveTrue().stream()
            .filter(k -> k.getKeyword() != null && !k.getKeyword().isBlank() && k.getMainStyle() != null)
            .sorted(Comparator.comparingInt((StyleKeyword k) -> k.getKeyword().trim().length()).reversed())
            .map(k -> new CompiledKeyword(compile(k.getKeyword()), k.getMainStyle(), k.getSubStyle()))
            .toList();
        cached = compiled;
        cachedAt = Instant.now();
        return compiled;
    }

    /** A keyword may start a longer word ("polska" in "polskan") but never end inside one. */
    private static Pattern compile(String keyword) {
        String quoted = Pattern.quote(keyword.trim().toLowerCase(Locale.ROOT));
        return Pattern.compile("(?<![\\p{L}\\p{N}])" + quoted);
    }
}
