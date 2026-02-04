package se.dansbart.domain.track;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrackDanceStyleRepository extends JpaRepository<TrackDanceStyle, UUID> {

    List<TrackDanceStyle> findByTrackId(UUID trackId);

    Optional<TrackDanceStyle> findByTrackIdAndDanceStyle(UUID trackId, String danceStyle);

    Optional<TrackDanceStyle> findByTrackIdAndIsPrimaryTrue(UUID trackId);

    @Modifying
    @Query("UPDATE TrackDanceStyle s SET s.confirmationCount = s.confirmationCount + 1 WHERE s.id = :id")
    void incrementConfirmationCount(UUID id);

    @Query("SELECT DISTINCT s.danceStyle FROM TrackDanceStyle s WHERE s.danceStyle IS NOT NULL ORDER BY s.danceStyle")
    List<String> findAllDistinctDanceStyles();
}
