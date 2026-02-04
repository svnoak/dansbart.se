package se.dansbart.domain.track;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrackStructureVersionRepository extends JpaRepository<TrackStructureVersion, UUID> {

    @Query("SELECT v FROM TrackStructureVersion v WHERE v.trackId = :trackId AND v.isHidden = false " +
           "ORDER BY v.isActive DESC, v.voteCount DESC, v.createdAt DESC")
    List<TrackStructureVersion> findByTrackIdOrderByActiveAndVotes(UUID trackId);

    Optional<TrackStructureVersion> findByTrackIdAndIsActiveTrue(UUID trackId);

    @Modifying
    @Query("UPDATE TrackStructureVersion v SET v.voteCount = v.voteCount + :delta WHERE v.id = :id")
    void updateVoteCount(UUID id, int delta);

    @Modifying
    @Query("UPDATE TrackStructureVersion v SET v.reportCount = v.reportCount + 1 WHERE v.id = :id")
    void incrementReportCount(UUID id);

    @Modifying
    @Query("UPDATE TrackStructureVersion v SET v.isActive = false WHERE v.trackId = :trackId")
    void deactivateAllForTrack(UUID trackId);
}
