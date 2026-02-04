package se.dansbart.dto;

import lombok.*;

/**
 * Minimal User DTO for embedding in other responses.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSummaryDto {

    private String id;
    private String username;
    private String displayName;
    private String avatarUrl;
}
