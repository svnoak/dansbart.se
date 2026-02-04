package se.dansbart.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

/**
 * Request DTO for adding a track to a playlist.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddTrackToPlaylistRequest {

    @NotNull(message = "Track ID is required")
    private UUID trackId;

    // Optional: position to insert at (null = append to end)
    private Integer position;
}
