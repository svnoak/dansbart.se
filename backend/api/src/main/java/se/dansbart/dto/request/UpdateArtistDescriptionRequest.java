package se.dansbart.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateArtistDescriptionRequest {
    private String description;
}
