package se.dansbart.domain.playlist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.TrackRepository;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.domain.user.PlaylistCollaboratorRepository;
import se.dansbart.domain.user.UserRepository;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.InvitationDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistTrackRepository playlistTrackRepository;
    private final TrackRepository trackRepository;
    private final PlaylistCollaboratorRepository collaboratorRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Optional<Playlist> findById(UUID id) {
        return playlistRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Playlist> findByUserId(String userId) {
        return playlistRepository.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<Playlist> findSharedWithUser(String userId) {
        return playlistRepository.findSharedWithUser(userId);
    }

    @Transactional
    public Playlist create(String userId, String name, String description) {
        Playlist playlist = Playlist.builder()
            .userId(userId)
            .name(name)
            .description(description)
            .isPublic(false)
            .build();
        return playlistRepository.save(playlist);
    }

    @Transactional
    public Optional<Playlist> update(UUID playlistId, String userId, String name, String description, Boolean isPublic) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                if (name != null) playlist.setName(name);
                if (description != null) playlist.setDescription(description);
                if (isPublic != null) playlist.setIsPublic(isPublic);
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistRepository.save(playlist);
            });
    }

    @Transactional
    public boolean delete(UUID playlistId, String userId) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                playlistRepository.delete(playlist);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<PlaylistTrack> addTrack(UUID playlistId, String userId, UUID trackId) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .flatMap(playlist -> trackRepository.findById(trackId).map(track -> {
                int nextPosition = playlist.getTracks().size();
                PlaylistTrack pt = PlaylistTrack.builder()
                    .playlistId(playlistId)
                    .trackId(trackId)
                    .position(nextPosition)
                    .build();
                return playlistTrackRepository.save(pt);
            }));
    }

    @Transactional
    public boolean removeTrack(UUID playlistId, String userId, UUID trackId) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .map(playlist -> {
                playlistTrackRepository.deleteByPlaylistIdAndTrackId(playlistId, trackId);
                reorderTracks(playlistId);
                return true;
            })
            .orElse(false);
    }

    private boolean hasEditPermission(UUID playlistId, String userId) {
        return collaboratorRepository.existsByPlaylistIdAndUserIdAndPermission(playlistId, userId, "edit");
    }

    private void reorderTracks(UUID playlistId) {
        List<PlaylistTrack> tracks = playlistTrackRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
        for (int i = 0; i < tracks.size(); i++) {
            tracks.get(i).setPosition(i);
        }
        playlistTrackRepository.saveAll(tracks);
    }

    // ===== Collaboration Methods =====

    @Transactional(readOnly = true)
    public Optional<Playlist> findByShareToken(String shareToken) {
        return playlistRepository.findByShareToken(shareToken);
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getPendingInvitations(String userId) {
        return collaboratorRepository.findByUserIdAndStatus(userId, "pending").stream()
            .map(collab -> {
                Playlist playlist = collab.getPlaylist();
                return InvitationDto.builder()
                    .id(collab.getId())
                    .playlistId(collab.getPlaylistId())
                    .playlistName(playlist != null ? playlist.getName() : null)
                    .invitedByUserId(collab.getInvitedBy())
                    .invitedByDisplayName(getDisplayNameForUser(collab.getInvitedBy()))
                    .permission(collab.getPermission())
                    .invitedAt(collab.getInvitedAt())
                    .build();
            })
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<PlaylistCollaborator> respondToInvitation(UUID invitationId, String userId, boolean accept) {
        return collaboratorRepository.findById(invitationId)
            .filter(collab -> collab.getUserId().equals(userId) && "pending".equals(collab.getStatus()))
            .map(collab -> {
                if (accept) {
                    collab.setStatus("accepted");
                    collab.setAcceptedAt(OffsetDateTime.now());
                    return collaboratorRepository.save(collab);
                } else {
                    collaboratorRepository.delete(collab);
                    return null;
                }
            });
    }

    @Transactional
    public boolean reorderTracks(UUID playlistId, String userId, List<UUID> trackIds) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .map(playlist -> {
                List<PlaylistTrack> tracks = playlistTrackRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
                for (int i = 0; i < trackIds.size(); i++) {
                    UUID trackId = trackIds.get(i);
                    for (PlaylistTrack pt : tracks) {
                        if (pt.getTrackId().equals(trackId)) {
                            pt.setPosition(i);
                            break;
                        }
                    }
                }
                playlistTrackRepository.saveAll(tracks);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<PlaylistCollaborator> inviteCollaborator(UUID playlistId, String ownerId, String inviteeId, String permission) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(ownerId))
            .filter(p -> !inviteeId.equals(ownerId))
            .filter(p -> collaboratorRepository.findByPlaylistIdAndUserId(playlistId, inviteeId).isEmpty())
            .map(playlist -> {
                PlaylistCollaborator collab = PlaylistCollaborator.builder()
                    .playlistId(playlistId)
                    .userId(inviteeId)
                    .permission(permission != null ? permission : "view")
                    .status("pending")
                    .invitedBy(ownerId)
                    .build();
                return collaboratorRepository.save(collab);
            });
    }

    @Transactional(readOnly = true)
    public List<CollaboratorDto> getCollaborators(UUID playlistId) {
        return collaboratorRepository.findByPlaylistId(playlistId).stream()
            .map(collab -> {
                var user = collab.getUser();
                return CollaboratorDto.builder()
                    .id(collab.getId())
                    .userId(collab.getUserId())
                    .username(user != null ? user.getUsername() : null)
                    .displayName(user != null ? user.getDisplayName() : null)
                    .permission(collab.getPermission())
                    .status(collab.getStatus())
                    .invitedAt(collab.getInvitedAt())
                    .acceptedAt(collab.getAcceptedAt())
                    .build();
            })
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<PlaylistCollaborator> updateCollaborator(UUID playlistId, String userId, UUID collaboratorId, String permission) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .flatMap(p -> collaboratorRepository.findById(collaboratorId))
            .filter(collab -> collab.getPlaylistId().equals(playlistId))
            .map(collab -> {
                collab.setPermission(permission);
                return collaboratorRepository.save(collab);
            });
    }

    @Transactional
    public boolean removeCollaborator(UUID playlistId, String userId, UUID collaboratorId) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .flatMap(p -> collaboratorRepository.findById(collaboratorId))
            .filter(collab -> collab.getPlaylistId().equals(playlistId))
            .map(collab -> {
                collaboratorRepository.delete(collab);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<Playlist> generateShareToken(UUID playlistId, String userId) {
        return playlistRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                playlist.setShareToken(UUID.randomUUID().toString());
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistRepository.save(playlist);
            });
    }

    private String getDisplayNameForUser(String userId) {
        if (userId == null) return null;
        return userRepository.findById(userId)
            .map(u -> u.getDisplayName())
            .orElse(null);
    }
}
