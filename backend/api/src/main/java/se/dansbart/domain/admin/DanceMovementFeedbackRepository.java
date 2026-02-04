package se.dansbart.domain.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DanceMovementFeedbackRepository extends JpaRepository<DanceMovementFeedback, UUID> {

    Optional<DanceMovementFeedback> findByDanceStyleAndMovementTag(String danceStyle, String movementTag);

    @Modifying
    @Query("UPDATE DanceMovementFeedback f SET f.occurrences = f.occurrences + 1, " +
           "f.score = (f.score * f.occurrences + 1.0) / (f.occurrences + 1) " +
           "WHERE f.danceStyle = :danceStyle AND f.movementTag = :movementTag")
    void incrementFeedback(String danceStyle, String movementTag);
}
