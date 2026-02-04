package se.dansbart.domain.track;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TrackRepository extends JpaRepository<Track, UUID> {

    /**
     * Find playable tracks with optional filters.
     * Uses a subquery to avoid DISTINCT + ORDER BY issues in PostgreSQL.
     */
    @Query(value = """
        SELECT t.* FROM tracks t
        WHERE t.id IN (
            SELECT DISTINCT t2.id FROM tracks t2
            JOIN track_dance_styles tds ON t2.id = tds.track_id
            JOIN playback_links pl ON t2.id = pl.track_id
            WHERE pl.is_working = true
            AND t2.processing_status = 'DONE'
            AND (:style IS NULL OR tds.dance_style = :style)
            AND (:minBpm IS NULL OR tds.effective_bpm >= :minBpm)
            AND (:maxBpm IS NULL OR tds.effective_bpm <= :maxBpm)
            AND (:hasVocals IS NULL OR t2.has_vocals = :hasVocals)
        )
        ORDER BY t.created_at DESC
        """,
        countQuery = """
        SELECT COUNT(DISTINCT t.id) FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.processing_status = 'DONE'
        AND (:style IS NULL OR tds.dance_style = :style)
        AND (:minBpm IS NULL OR tds.effective_bpm >= :minBpm)
        AND (:maxBpm IS NULL OR tds.effective_bpm <= :maxBpm)
        AND (:hasVocals IS NULL OR t.has_vocals = :hasVocals)
        """,
        nativeQuery = true)
    Page<Track> findPlayableTracks(
        @Param("style") String style,
        @Param("minBpm") Integer minBpm,
        @Param("maxBpm") Integer maxBpm,
        @Param("hasVocals") Boolean hasVocals,
        Pageable pageable
    );

    /**
     * Find similar tracks using pgvector similarity.
     */
    @Query(value = """
        SELECT t.* FROM tracks t
        WHERE t.embedding IS NOT NULL
        AND t.id != :trackId
        AND t.processing_status = 'DONE'
        ORDER BY t.embedding <-> (SELECT embedding FROM tracks WHERE id = :trackId)
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findSimilarTracks(@Param("trackId") UUID trackId, @Param("limit") int limit);

    /**
     * Search tracks by title.
     */
    @Query("SELECT t FROM Track t WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Track> searchByTitle(@Param("query") String query, Pageable pageable);

    /**
     * Find tracks by artist ID.
     */
    @Query(value = """
        SELECT t.* FROM tracks t
        JOIN track_artists ta ON t.id = ta.track_id
        WHERE ta.artist_id = :artistId
        ORDER BY t.title
        """, nativeQuery = true)
    List<Track> findByArtistId(@Param("artistId") UUID artistId);

    /**
     * Find tracks by album ID.
     */
    @Query(value = """
        SELECT t.* FROM tracks t
        JOIN track_albums talb ON t.id = talb.track_id
        WHERE talb.album_id = :albumId
        ORDER BY t.title
        """, nativeQuery = true)
    List<Track> findByAlbumId(@Param("albumId") UUID albumId);

    /**
     * Find tracks by IDs preserving order.
     */
    @Query("SELECT t FROM Track t WHERE t.id IN :ids")
    List<Track> findByIds(@Param("ids") List<UUID> ids);

    /**
     * Find recent verified tracks (confidence = 1.0 means user-confirmed).
     * Used for /discovery/recent endpoint.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND tds.confidence >= 1.0
        AND t.is_flagged = false
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findRecentVerifiedTracks(@Param("limit") int limit);

    /**
     * Find curated tracks: user-confirmed, has audio analysis, sorted by popularity.
     * Used for /discovery/curated endpoint.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        LEFT JOIN (
            SELECT track_id, COUNT(id) as plays
            FROM track_playbacks
            GROUP BY track_id
        ) tp ON t.id = tp.track_id
        WHERE pl.is_working = true
        AND tds.confidence = 1.0
        AND t.is_flagged = false
        AND t.bounciness IS NOT NULL
        AND t.articulation IS NOT NULL
        ORDER BY COALESCE(tp.plays, 0) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findCuratedTracks(@Param("limit") int limit);

    /**
     * Find fallback recent tracks (high confidence, but not necessarily user-confirmed).
     * Used when not enough popular tracks with good completion rate.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND tds.is_primary = true
        AND tds.confidence >= 0.8
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findFallbackTracks(@Param("limit") int limit);

    /**
     * Get style counts for discovery by-style endpoint.
     * Returns [dance_style, count].
     */
    @Query(value = """
        SELECT tds.dance_style, COUNT(DISTINCT t.id) as track_count
        FROM track_dance_styles tds
        JOIN tracks t ON tds.track_id = t.id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND tds.dance_style IS NOT NULL
        AND t.is_flagged = false
        GROUP BY tds.dance_style
        ORDER BY track_count DESC
        """, nativeQuery = true)
    List<Object[]> findStyleCounts();

    /**
     * Get sub-styles for a main style.
     */
    @Query(value = """
        SELECT DISTINCT tds.sub_style
        FROM track_dance_styles tds
        WHERE tds.dance_style = :mainStyle
        AND tds.sub_style IS NOT NULL
        AND tds.confidence > 0.3
        """, nativeQuery = true)
    List<String> findSubStylesForStyle(@Param("mainStyle") String mainStyle);

    /**
     * Find tracks by style with good confidence.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND tds.dance_style = :style
        AND tds.confidence >= :minConfidence
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findByStyleWithConfidence(
        @Param("style") String style,
        @Param("minConfidence") float minConfidence,
        @Param("limit") int limit
    );

    /**
     * Find tracks by multiple styles.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND tds.dance_style IN :styles
        AND tds.confidence >= :minConfidence
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findByStylesWithConfidence(
        @Param("styles") List<String> styles,
        @Param("minConfidence") float minConfidence,
        @Param("limit") int limit
    );

    /**
     * Find instrumental tracks.
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND t.has_vocals = false
        AND tds.confidence >= :minConfidence
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findInstrumentalTracks(
        @Param("minConfidence") float minConfidence,
        @Param("limit") int limit
    );

    /**
     * Find slow tracks (low BPM).
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND tds.effective_bpm IS NOT NULL
        AND tds.effective_bpm <= :maxBpm
        AND tds.confidence >= :minConfidence
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findSlowTracks(
        @Param("maxBpm") int maxBpm,
        @Param("minConfidence") float minConfidence,
        @Param("limit") int limit
    );

    /**
     * Find fast tracks (high BPM).
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND tds.effective_bpm IS NOT NULL
        AND tds.effective_bpm >= :minBpm
        AND tds.confidence >= :minConfidence
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findFastTracks(
        @Param("minBpm") int minBpm,
        @Param("minConfidence") float minConfidence,
        @Param("limit") int limit
    );

    /**
     * Find beginner-friendly tracks (instrumental, medium tempo, specified style).
     */
    @Query(value = """
        SELECT DISTINCT t.* FROM tracks t
        JOIN track_dance_styles tds ON t.id = tds.track_id
        JOIN playback_links pl ON t.id = pl.track_id
        WHERE pl.is_working = true
        AND t.is_flagged = false
        AND t.has_vocals = false
        AND tds.dance_style = :style
        AND tds.confidence >= 0.8
        AND (tds.effective_bpm IS NULL OR (tds.effective_bpm >= 80 AND tds.effective_bpm <= 140))
        ORDER BY t.created_at DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Track> findBeginnerFriendlyByStyle(
        @Param("style") String style,
        @Param("limit") int limit
    );

    /**
     * Find tracks by processing status.
     */
    List<Track> findByProcessingStatus(String status);

    /**
     * Find tracks stuck in a processing status since before a given time.
     */
    @Query("SELECT t FROM Track t WHERE t.processingStatus = :status AND t.createdAt < :threshold")
    List<Track> findByProcessingStatusAndCreatedAtBefore(
        @Param("status") String status,
        @Param("threshold") java.time.OffsetDateTime threshold
    );

    /**
     * Count tracks with non-null ISRC.
     */
    long countByIsrcNotNull();

    /**
     * Count tracks with ISRC starting with a prefix (e.g., "FALLBACK_").
     */
    long countByIsrcStartingWith(String prefix);

    /**
     * Find tracks by ISRC.
     */
    List<Track> findByIsrc(String isrc);

    /**
     * Find ISRCs that have multiple tracks (duplicates).
     * Returns [isrc, count].
     */
    @Query(value = """
        SELECT t.isrc, COUNT(t.id) as count
        FROM tracks t
        WHERE t.isrc IS NOT NULL
        GROUP BY t.isrc
        HAVING COUNT(t.id) > 1
        ORDER BY count DESC
        LIMIT :limit OFFSET :offset
        """, nativeQuery = true)
    List<Object[]> findDuplicateIsrcs(@Param("limit") int limit, @Param("offset") int offset);
}
