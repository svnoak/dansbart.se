package se.dansbart.domain.submission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.admin.StyleKeyword;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StyleSuggesterTest {

    @Mock
    private StyleKeywordJooqRepository keywordRepository;

    private StyleSuggester suggester;

    @BeforeEach
    void setUp() {
        when(keywordRepository.findByIsActiveTrue()).thenReturn(List.of(
            keyword("polska", "Polska", null),
            keyword("slängpolska", "Polska", "Slängpolska"),
            keyword("schottis", "Schottis", null),
            keyword("vals", "Vals", null),
            keyword("hambo", "Hambo", null)
        ));
        suggester = new StyleSuggester(keywordRepository);
    }

    @Test
    void longestKeywordWins() {
        assertThat(suggester.suggest("Slängpolska efter Pekkos Per", null))
            .contains(new StyleSuggester.Suggestion("Polska", "Slängpolska"));
    }

    @Test
    void matchesInflectedWordsCaseInsensitively() {
        assertThat(suggester.suggest("POLSKAN från Bingsjö", null))
            .contains(new StyleSuggester.Suggestion("Polska", null));
    }

    @Test
    void doesNotMatchInsideAnotherWord() {
        assertThat(suggester.suggest("Kvalsång", null)).isEmpty();
        assertThat(suggester.suggest("Schottisen", null)).contains(new StyleSuggester.Suggestion("Schottis", null));
    }

    @Test
    void fallsBackToTheAlbumName() {
        assertThat(suggester.suggest("Låt nr 3", "Hambolåtar från Hälsingland"))
            .contains(new StyleSuggester.Suggestion("Hambo", null));
    }

    @Test
    void emptyWhenNothingMatches() {
        assertThat(suggester.suggest("Sommarsång", "Visor")).isEmpty();
        assertThat(suggester.suggest(null, null)).isEmpty();
    }

    @Test
    void cachesTheKeywordList() {
        suggester.suggest("Polska", null);
        suggester.suggest("Vals", null);
        verify(keywordRepository, times(1)).findByIsActiveTrue();
    }

    private static StyleKeyword keyword(String keyword, String main, String sub) {
        return StyleKeyword.builder().keyword(keyword).mainStyle(main).subStyle(sub).isActive(true).build();
    }
}
