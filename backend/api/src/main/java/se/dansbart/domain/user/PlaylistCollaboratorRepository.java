package se.dansbart.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlaylistCollaboratorRepository extends JpaRepository<PlaylistCollaborator, UUID> {

    @Query("SELECT pc FROM PlaylistCollaborator pc WHERE pc.playlistId = :playlistId AND pc.userId = :userId")
    Optional<PlaylistCollaborator> findByPlaylistIdAndUserId(
        @Param("playlistId") UUID playlistId,
        @Param("userId") String userId
    );

    boolean existsByPlaylistIdAndUserIdAndPermission(UUID playlistId, String userId, String permission);

    List<PlaylistCollaborator> findByPlaylistId(UUID playlistId);

    List<PlaylistCollaborator> findByUserIdAndStatus(String userId, String status);

    void deleteByPlaylistIdAndId(UUID playlistId, UUID collaboratorId);
}
