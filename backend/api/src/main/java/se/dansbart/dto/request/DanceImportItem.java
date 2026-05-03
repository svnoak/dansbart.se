package se.dansbart.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DanceImportItem {
    private String name;
    private String danceDescriptionUrl;
    private String danceType;
    private String music;
}
