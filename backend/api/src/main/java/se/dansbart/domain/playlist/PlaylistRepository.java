package se.dansbart.domain.playlist;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistRepository extends JpaRepository<Playlist, UUID> {

    List<Playlist> findByUserId(String userId);

    @Query("SELECT p FROM Playlist p WHERE p.isPublic = true")
    List<Playlist> findPublicPlaylists();

    @Query(value = """
        SELECT p.* FROM playlists p
        JOIN playlist_collaborators pc ON p.id = pc.playlist_id
        WHERE pc.user_id = :userId
        """, nativeQuery = true)
    List<Playlist> findSharedWithUser(@Param("userId") String userId);

    Optional<Playlist> findByShareToken(String shareToken);
}
