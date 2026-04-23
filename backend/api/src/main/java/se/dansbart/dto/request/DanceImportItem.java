package se.dansbart.dto.request;

import lombok.*;

/**
 * One entry from the ACLA indexer JSON output.
 * Matches the shape produced by scripts/index_acla_dances.py.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DanceImportItem {
    private String name;
    private String danceDescriptionUrl;
    private String danstyp;
    private String musik;
}
