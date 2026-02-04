package se.dansbart.domain.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PendingArtistApprovalRepository extends JpaRepository<PendingArtistApproval, UUID> {

    Page<PendingArtistApproval> findByStatusOrderByDiscoveredAtDesc(String status, Pageable pageable);

    Optional<PendingArtistApproval> findBySpotifyId(String spotifyId);

    boolean existsBySpotifyId(String spotifyId);

    @Query("SELECT p FROM PendingArtistApproval p WHERE p.status = :status " +
           "AND LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<PendingArtistApproval> searchByNameAndStatus(
            @Param("search") String search,
            @Param("status") String status,
            Pageable pageable);

    long countByStatus(String status);
}
