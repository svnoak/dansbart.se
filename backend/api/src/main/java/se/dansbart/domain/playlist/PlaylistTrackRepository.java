package se.dansbart.domain.playlist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PlaylistTrackRepository extends JpaRepository<PlaylistTrack, UUID> {

    List<PlaylistTrack> findByPlaylistIdOrderByPositionAsc(UUID playlistId);

    @Modifying
    @Query("DELETE FROM PlaylistTrack pt WHERE pt.playlistId = :playlistId AND pt.trackId = :trackId")
    void deleteByPlaylistIdAndTrackId(@Param("playlistId") UUID playlistId, @Param("trackId") UUID trackId);
}
