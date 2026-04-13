package se.dansbart.dto;

import lombok.*;

import java.util.UUID;

/**
 * Minimal User DTO for embedding in other responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSummaryDto {

    private UUID id;
    private String username;
    private String displayName;
    private String avatarUrl;
}
