package se.dansbart.domain.admin;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "dance_movement_feedback",
       uniqueConstraints = @UniqueConstraint(name = "_dance_move_uc", columnNames = {"dance_style", "movement_tag"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DanceMovementFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "dance_style", nullable = false)
    private String danceStyle;

    @Column(name = "movement_tag", nullable = false)
    private String movementTag;

    @Column(name = "score")
    @Builder.Default
    private Float score = 0.0f;

    @Column(name = "occurrences")
    @Builder.Default
    private Integer occurrences = 0;
}
