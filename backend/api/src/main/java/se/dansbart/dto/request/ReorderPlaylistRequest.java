package se.dansbart.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Request DTO for reordering tracks in a playlist.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReorderPlaylistRequest {

    @NotNull(message = "Track order is required")
    private List<UUID> trackIds;
}
