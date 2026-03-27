package se.dansbart.domain.admin.folkwiki;

import com.fasterxml.jackson.annotation.JsonProperty;

public record FolkwikiTuneImport(
    String title,
    @JsonProperty("normalized_title") String normalizedTitle,
    @JsonProperty("folkwiki_style") String folkwikiStyle,
    @JsonProperty("config_style") String configStyle,
    @JsonProperty("abc_rhythm") String abcRhythm,
    String meter,
    @JsonProperty("beats_per_bar") Integer beatsPerBar,
    @JsonProperty("folkwiki_id") String folkwikiId
) {}
