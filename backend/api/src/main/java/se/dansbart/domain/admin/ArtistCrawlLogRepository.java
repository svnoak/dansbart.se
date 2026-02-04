package se.dansbart.domain.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ArtistCrawlLogRepository extends JpaRepository<ArtistCrawlLog, UUID> {

    Page<ArtistCrawlLog> findAllByOrderByCrawledAtDesc(Pageable pageable);

    @Query("SELECT l.musicGenreClassification, COUNT(l) FROM ArtistCrawlLog l GROUP BY l.musicGenreClassification")
    List<Object[]> countByMusicGenre();

    @Query("SELECT l.status, COUNT(l) FROM ArtistCrawlLog l GROUP BY l.status")
    List<Object[]> countByStatus();

    @Query("SELECT SUM(l.tracksFound) FROM ArtistCrawlLog l")
    Long sumTracksFound();

    boolean existsBySpotifyArtistId(String spotifyArtistId);
}
