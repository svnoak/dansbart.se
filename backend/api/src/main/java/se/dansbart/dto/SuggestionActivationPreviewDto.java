package se.dansbart.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuggestionActivationPreviewDto {
    private String mainStyle;
    private String subStyle;
    private Integer proposedBeatsPerBar;
    private long affectedTrackCount;
}
