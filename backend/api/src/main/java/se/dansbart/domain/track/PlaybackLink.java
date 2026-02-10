package se.dansbart.domain.track;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaybackLink {

    private UUID id;
    private UUID trackId;
    private Track track;
    private String platform;
    private String deepLink;

    @Builder.Default
    private Boolean isWorking = true;
}
