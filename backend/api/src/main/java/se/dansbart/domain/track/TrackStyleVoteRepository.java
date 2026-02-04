package se.dansbart.domain.track;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrackStyleVoteRepository extends JpaRepository<TrackStyleVote, UUID> {

    List<TrackStyleVote> findByTrackId(UUID trackId);

    Optional<TrackStyleVote> findByTrackIdAndVoterId(UUID trackId, String voterId);

    long countByTrackIdAndSuggestedStyle(UUID trackId, String suggestedStyle);
}
