package se.dansbart.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * What the holder of a guest code sees of the list: enough to know which list it is
 * and what is already in it. A playlist fills {@code tracks}; a dance list fills {@code dances}.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuestListDto {

    /** "playlist" or "dance_list". */
    private String type;
    private String name;
    private String description;
    private String ownerName;

    private List<TrackListDto> tracks;
    private List<GuestDanceDto> dances;

    public record GuestDanceDto(UUID danceId, String name) {}
}
