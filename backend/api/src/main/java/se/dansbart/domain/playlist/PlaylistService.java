package se.dansbart.domain.playlist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.domain.user.PlaylistCollaboratorJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.InvitationDto;
import se.dansbart.dto.PlaylistDto;
import se.dansbart.dto.PlaylistTrackDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.UserSummaryDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistJooqRepository playlistJooqRepository;
    private final PlaylistTrackJooqRepository playlistTrackJooqRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final PlaylistCollaboratorJooqRepository collaboratorRepository;
    private final UserJooqRepository userJooqRepository;

    @Transactional(readOnly = true)
    public Optional<Playlist> findById(UUID id) {
        return playlistJooqRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Playlist> findByUserId(String userId) {
        return playlistJooqRepository.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<Playlist> findSharedWithUser(String userId) {
        return playlistJooqRepository.findSharedWithUser(userId);
    }

    @Transactional
    public Playlist create(String userId, String name, String description) {
        Playlist playlist = Playlist.builder()
            .userId(userId)
            .name(name)
            .description(description)
            .isPublic(false)
            .build();
        return playlistJooqRepository.insert(playlist);
    }

    @Transactional
    public Optional<Playlist> update(UUID playlistId, String userId, String name, String description, Boolean isPublic) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                if (name != null) playlist.setName(name);
                if (description != null) playlist.setDescription(description);
                if (isPublic != null) playlist.setIsPublic(isPublic);
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistJooqRepository.update(playlist);
            });
    }

    @Transactional
    public boolean delete(UUID playlistId, String userId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                playlistJooqRepository.delete(playlistId);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<PlaylistTrack> addTrack(UUID playlistId, String userId, UUID trackId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .flatMap(playlist -> trackJooqRepository.findById(trackId).map(track -> {
                int nextPosition = playlistJooqRepository.getTrackCount(playlistId);
                PlaylistTrack pt = PlaylistTrack.builder()
                    .playlistId(playlistId)
                    .trackId(trackId)
                    .position(nextPosition)
                    .build();
                return playlistTrackJooqRepository.insert(pt);
            }));
    }

    @Transactional
    public boolean removeTrack(UUID playlistId, String userId, UUID trackId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .map(playlist -> {
                playlistTrackJooqRepository.deleteByPlaylistIdAndTrackId(playlistId, trackId);
                reorderTracks(playlistId);
                return true;
            })
            .orElse(false);
    }

    private boolean hasEditPermission(UUID playlistId, String userId) {
        return playlistJooqRepository.existsByPlaylistIdAndUserIdAndPermission(playlistId, userId, "edit");
    }

    private void reorderTracks(UUID playlistId) {
        List<PlaylistTrack> tracks = playlistTrackJooqRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
        for (int i = 0; i < tracks.size(); i++) {
            tracks.get(i).setPosition(i);
        }
        playlistTrackJooqRepository.saveAll(tracks);
    }

    // ===== Collaboration Methods =====

    @Transactional(readOnly = true)
    public Optional<Playlist> findByShareToken(String shareToken) {
        return playlistJooqRepository.findByShareToken(shareToken);
    }

    /** Playlist detail with tracks as TrackListDto (danceStyle, subStyle, playback, artist). */
    @Transactional(readOnly = true)
    public Optional<PlaylistDto> findByIdAsDto(UUID playlistId) {
        return playlistJooqRepository.findById(playlistId)
            .map(this::toPlaylistDto);
    }

    /** Playlist by share token with tracks as TrackListDto. */
    @Transactional(readOnly = true)
    public Optional<PlaylistDto> findByShareTokenAsDto(String shareToken) {
        return playlistJooqRepository.findByShareToken(shareToken)
            .map(this::toPlaylistDto);
    }

    private PlaylistDto toPlaylistDto(Playlist playlist) {
        UserSummaryDto owner = playlist.getUserId() != null
            ? userJooqRepository.findById(playlist.getUserId())
                .map(u -> UserSummaryDto.builder()
                    .id(u.getId())
                    .username(u.getUsername())
                    .displayName(u.getDisplayName())
                    .avatarUrl(u.getAvatarUrl())
                    .build())
                .orElse(null)
            : null;
        List<PlaylistTrack> ptList = playlistTrackJooqRepository.findByPlaylistIdOrderByPositionAsc(playlist.getId());
        List<UUID> trackIds = ptList.stream().map(PlaylistTrack::getTrackId).toList();
        List<TrackListDto> trackDtos = trackJooqRepository.findTrackListDtosByIds(trackIds);
        List<PlaylistTrackDto> playlistTrackDtos = new java.util.ArrayList<>();
        for (int i = 0; i < ptList.size(); i++) {
            PlaylistTrack pt = ptList.get(i);
            TrackListDto trackDto = i < trackDtos.size() ? trackDtos.get(i) : null;
            playlistTrackDtos.add(PlaylistTrackDto.builder()
                .id(pt.getId())
                .position(pt.getPosition())
                .addedAt(pt.getAddedAt())
                .addedByUserId(null)
                .track(trackDto)
                .build());
        }
        List<UserSummaryDto> collaborators = collaboratorRepository.findByPlaylistId(playlist.getId()).stream()
            .map(c -> c.getUser() != null ? UserSummaryDto.builder()
                .id(c.getUser().getId())
                .username(c.getUser().getUsername())
                .displayName(c.getUser().getDisplayName())
                .avatarUrl(c.getUser().getAvatarUrl())
                .build() : null)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toList());
        return PlaylistDto.builder()
            .id(playlist.getId())
            .name(playlist.getName())
            .description(playlist.getDescription())
            .isPublic(playlist.getIsPublic())
            .shareToken(playlist.getShareToken())
            .createdAt(playlist.getCreatedAt())
            .updatedAt(playlist.getUpdatedAt())
            .owner(owner)
            .trackCount(playlistTrackDtos.size())
            .tracks(playlistTrackDtos)
            .collaborators(collaborators)
            .build();
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
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId) || hasEditPermission(playlistId, userId))
            .map(playlist -> {
                List<PlaylistTrack> tracks = playlistTrackJooqRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
                for (int i = 0; i < trackIds.size(); i++) {
                    UUID trackId = trackIds.get(i);
                    for (PlaylistTrack pt : tracks) {
                        if (pt.getTrackId().equals(trackId)) {
                            pt.setPosition(i);
                            break;
                        }
                    }
                }
                playlistTrackJooqRepository.saveAll(tracks);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<PlaylistCollaborator> inviteCollaborator(UUID playlistId, String ownerId, String inviteeId, String permission) {
        return playlistJooqRepository.findById(playlistId)
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
        return playlistJooqRepository.findById(playlistId)
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
        return playlistJooqRepository.findById(playlistId)
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
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> p.getUserId().equals(userId))
            .map(playlist -> {
                playlist.setShareToken(UUID.randomUUID().toString());
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistJooqRepository.update(playlist);
            });
    }

    private String getDisplayNameForUser(String userId) {
        if (userId == null) return null;
        return userJooqRepository.findById(userId)
            .map(u -> u.getDisplayName())
            .orElse(null);
    }
}
