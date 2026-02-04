package se.dansbart.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Request DTO for submitting feedback on a track's classification.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackFeedbackRequest {

    @NotBlank(message = "Dance style is required")
    @Size(max = 100, message = "Dance style must be at most 100 characters")
    private String danceStyle;

    @Size(max = 100, message = "Sub-style must be at most 100 characters")
    private String subStyle;

    // Optional: user's reasoning for the correction
    @Size(max = 500, message = "Comment must be at most 500 characters")
    private String comment;
}
