package se.dansbart.dto;

import lombok.*;
import java.util.List;

/**
 * Style overview DTO for discovery by-style endpoint.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StyleOverviewDto {

    private String style;
    private List<String> subStyles;
    private Long trackCount;
}
