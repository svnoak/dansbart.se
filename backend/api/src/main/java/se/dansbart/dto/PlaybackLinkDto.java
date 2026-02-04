package se.dansbart.dto;

import lombok.*;
import java.util.UUID;

/**
 * DTO for playback links (Spotify, YouTube, etc.)
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaybackLinkDto {

    private UUID id;
    private String platform;
    private String deepLink;
    private Boolean isWorking;
}
