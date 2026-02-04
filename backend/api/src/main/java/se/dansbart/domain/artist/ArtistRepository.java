package se.dansbart.domain.artist;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ArtistRepository extends JpaRepository<Artist, UUID> {

    Optional<Artist> findBySpotifyId(String spotifyId);

    @Query("SELECT a FROM Artist a WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Artist> searchByName(@Param("query") String query, Pageable pageable);

    @Query("SELECT a FROM Artist a WHERE a.isVerified = true")
    Page<Artist> findVerifiedArtists(Pageable pageable);
}
