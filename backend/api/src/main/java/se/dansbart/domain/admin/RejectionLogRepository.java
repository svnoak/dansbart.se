package se.dansbart.domain.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RejectionLogRepository extends JpaRepository<RejectionLog, UUID> {

    Page<RejectionLog> findAllByOrderByRejectedAtDesc(Pageable pageable);

    Page<RejectionLog> findByEntityTypeOrderByRejectedAtDesc(String entityType, Pageable pageable);

    Optional<RejectionLog> findBySpotifyIdAndEntityType(String spotifyId, String entityType);

    boolean existsBySpotifyIdAndEntityType(String spotifyId, String entityType);
}
