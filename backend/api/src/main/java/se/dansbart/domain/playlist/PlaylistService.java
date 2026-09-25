package se.dansbart.domain.playlist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.CollaborationAccess;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.group.GroupMember;
import se.dansbart.domain.group.GroupMemberJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.domain.user.PlaylistCollaboratorJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.EditablePlaylistDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.InvitationDto;
import se.dansbart.dto.PlaylistDto;
import se.dansbart.dto.PlaylistListItemDto;
import se.dansbart.dto.PlaylistTrackDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.UserSummaryDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.exception.UnprocessableEntityException;

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
    private final GroupJooqRepository groupJooqRepository;
    private final GroupMemberJooqRepository groupMemberJooqRepository;
    private final CollaborationAccess collaborationAccess;

    @Transactional(readOnly = true)
    public Optional<Playlist> findById(UUID id) {
        return playlistJooqRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Playlist> findByUserId(UUID userId) {
        return playlistJooqRepository.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public List<PlaylistListItemDto> findOwnedAndGroupPlaylists(UUID userId) {
        return playlistJooqRepository.findOwnedAndGroupPlaylistsByUserId(userId).stream()
            .map(record -> {
                Playlist playlist = record.playlist();
                GroupSummaryDto ownerGroup = playlist.getGroupId() != null
                    ? GroupSummaryDto.builder().id(playlist.getGroupId()).name(record.groupName()).build()
                    : null;
                return PlaylistListItemDto.builder()
                    .id(playlist.getId())
                    .name(playlist.getName())
                    .description(playlist.getDescription())
                    .isPublic(playlist.getIsPublic())
                    .danceStyle(playlist.getDanceStyle())
                    .subStyle(playlist.getSubStyle())
                    .tempoCategory(playlist.getTempoCategory())
                    .trackCount(record.trackCount())
                    .ownerGroup(ownerGroup)
                    .build();
            })
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Playlist> findSharedWithUser(UUID userId) {
        return playlistJooqRepository.findSharedWithUser(userId);
    }

    @Transactional(readOnly = true)
    public List<EditablePlaylistDto> findEditableByUserId(UUID userId) {
        return playlistJooqRepository.findEditableByUserId(userId).stream()
            .map(record -> EditablePlaylistDto.builder()
                .id(record.id())
                .name(record.name())
                .ownerGroupName(record.groupName())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public Playlist create(UUID userId, String name, String description) {
        Playlist playlist = Playlist.builder()
            .userId(userId)
            .name(name)
            .description(description)
            .isPublic(false)
            .build();
        return playlistJooqRepository.insert(playlist);
    }

    @Transactional
    public PlaylistDto createForGroup(UUID groupId, UUID creatorId, String name, String description) {
        Playlist playlist = Playlist.builder()
            .groupId(groupId)
            .name(name)
            .description(description)
            .isPublic(false)
            .build();
        return toPlaylistDto(playlistJooqRepository.insert(playlist), creatorId);
    }

    @Transactional
    public Optional<Playlist> update(UUID playlistId, UUID userId, String name, String description, Boolean isPublic, String danceStyle, String subStyle, String tempoCategory) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
            .map(playlist -> {
                boolean fullControl = hasFullControl(playlist, userId);
                if (name != null) playlist.setName(name);
                if (fullControl) {
                    if (description != null) playlist.setDescription(description);
                    if (isPublic != null) playlist.setIsPublic(isPublic);
                    if (danceStyle != null) playlist.setDanceStyle(danceStyle.isEmpty() ? null : danceStyle);
                    if (subStyle != null) playlist.setSubStyle(subStyle.isEmpty() ? null : subStyle);
                    if (tempoCategory != null) playlist.setTempoCategory(tempoCategory.isEmpty() ? null : tempoCategory);
                }
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistJooqRepository.update(playlist);
            });
    }

    @Transactional
    public boolean delete(UUID playlistId, UUID userId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasFullControl(p, userId))
            .map(playlist -> {
                playlistJooqRepository.delete(playlistId);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<PlaylistTrack> addTrack(UUID playlistId, UUID userId, UUID trackId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
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
    public boolean removeTrack(UUID playlistId, UUID userId, UUID trackId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
            .map(playlist -> {
                playlistTrackJooqRepository.deleteByPlaylistIdAndTrackId(playlistId, trackId);
                reorderTracks(playlistId);
                return true;
            })
            .orElse(false);
    }

    private boolean hasEditPermission(UUID playlistId, UUID userId) {
        return playlistJooqRepository.existsByPlaylistIdAndUserIdAndPermission(playlistId, userId, "edit");
    }

    private boolean hasFullControl(Playlist playlist, UUID userId) {
        return collaborationAccess.hasFullControl(playlist.getUserId(), playlist.getGroupId(), userId);
    }

    private boolean hasEditAccess(Playlist playlist, UUID userId) {
        return collaborationAccess.hasEditAccess(playlist.getUserId(), playlist.getGroupId(), userId,
            () -> hasEditPermission(playlist.getId(), userId));
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
    public Optional<PlaylistDto> findByIdAsDto(UUID playlistId, UUID viewerId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(playlist -> canView(playlist, viewerId))
            .map(playlist -> toPlaylistDto(playlist, viewerId));
    }

    private boolean canView(Playlist playlist, UUID viewerId) {
        return collaborationAccess.canView(Boolean.TRUE.equals(playlist.getIsPublic()), playlist.getGroupId(), viewerId,
            () -> hasEditAccess(playlist, viewerId),
            () -> collaboratorRepository.findByPlaylistIdAndUserId(playlist.getId(), viewerId)
                .filter(c -> "accepted".equals(c.getStatus()))
                .isPresent());
    }

    /** Playlist by share token with tracks as TrackListDto. */
    @Transactional(readOnly = true)
    public Optional<PlaylistDto> findByShareTokenAsDto(String shareToken) {
        return playlistJooqRepository.findByShareToken(shareToken)
            .map(playlist -> toPlaylistDto(playlist, null));
    }

    private PlaylistDto toPlaylistDto(Playlist playlist, UUID viewerId) {
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
        GroupSummaryDto ownerGroup = playlist.getGroupId() != null
            ? groupJooqRepository.findById(playlist.getGroupId())
                .map(g -> GroupSummaryDto.builder().id(g.getId()).name(g.getName()).build())
                .orElse(null)
            : null;
        Boolean viewerCanManage = viewerId != null ? hasFullControl(playlist, viewerId) : null;
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
        List<CollaboratorDto> collaborators = collaboratorRepository.findByPlaylistId(playlist.getId()).stream()
            .map(c -> {
                var user = c.getUser();
                return CollaboratorDto.builder()
                    .id(c.getId())
                    .userId(c.getUserId())
                    .username(user != null ? user.getUsername() : null)
                    .displayName(user != null ? user.getDisplayName() : null)
                    .permission(c.getPermission())
                    .status(c.getStatus())
                    .invitedAt(c.getInvitedAt())
                    .acceptedAt(c.getAcceptedAt())
                    .build();
            })
            .collect(Collectors.toList());
        return PlaylistDto.builder()
            .id(playlist.getId())
            .name(playlist.getName())
            .description(playlist.getDescription())
            .isPublic(playlist.getIsPublic())
            .shareToken(playlist.getShareToken())
            .danceStyle(playlist.getDanceStyle())
            .subStyle(playlist.getSubStyle())
            .tempoCategory(playlist.getTempoCategory())
            .createdAt(playlist.getCreatedAt())
            .updatedAt(playlist.getUpdatedAt())
            .owner(owner)
            .ownerGroup(ownerGroup)
            .viewerCanManage(viewerCanManage)
            .trackCount(playlistTrackDtos.size())
            .tracks(playlistTrackDtos)
            .collaborators(collaborators)
            .build();
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getPendingInvitations(UUID userId) {
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
    public Optional<PlaylistCollaborator> respondToInvitation(UUID invitationId, UUID userId, boolean accept) {
        PlaylistCollaborator collab = collaboratorRepository.findById(invitationId)
            .filter(c -> userId.equals(c.getUserId()) && "pending".equals(c.getStatus()))
            .orElseThrow(() -> new ResourceNotFoundException("This invitation does not exist."));
        if (accept) {
            collab.setStatus("accepted");
            collab.setAcceptedAt(OffsetDateTime.now());
            return Optional.of(collaboratorRepository.save(collab));
        }
        collaboratorRepository.delete(collab);
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public List<InvitationDto> getPendingInvitationsForGroup(UUID groupId, UUID viewerId) {
        requireGroupAdmin(groupId, viewerId);
        return collaboratorRepository.findByGroupIdAndStatus(groupId, "pending").stream()
            .map(invitation -> InvitationDto.builder()
                .id(invitation.id())
                .playlistId(invitation.playlistId())
                .playlistName(invitation.playlistName())
                .invitedByUserId(invitation.invitedByUserId())
                .invitedByDisplayName(invitation.invitedByDisplayName())
                .permission(invitation.permission())
                .invitedAt(invitation.invitedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<PlaylistCollaborator> respondToGroupInvitation(UUID groupId, UUID invitationId, UUID viewerId, boolean accept) {
        requireGroupAdmin(groupId, viewerId);
        PlaylistCollaborator collab = collaboratorRepository.findById(invitationId)
            .filter(c -> groupId.equals(c.getGroupId()) && "pending".equals(c.getStatus()))
            .orElseThrow(() -> new ResourceNotFoundException("This invitation does not exist."));
        if (accept) {
            collab.setStatus("accepted");
            collab.setAcceptedAt(OffsetDateTime.now());
            return Optional.of(collaboratorRepository.save(collab));
        }
        collaboratorRepository.delete(collab);
        return Optional.empty();
    }

    private void requireGroupAdmin(UUID groupId, UUID viewerId) {
        Group group = groupJooqRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("The group does not exist, or you do not have access to it."));
        var membership = groupMemberJooqRepository.findByGroupIdAndUserId(groupId, viewerId)
            .filter(GroupMember::isAccepted);
        if (membership.isEmpty() && !Boolean.TRUE.equals(group.getIsPublic())) {
            throw new ResourceNotFoundException("The group does not exist, or you do not have access to it.");
        }
        if (membership.isEmpty() || !Boolean.TRUE.equals(membership.get().getIsAdmin())) {
            throw new ForbiddenException("You do not have permission to do this in the group.");
        }
    }

    @Transactional
    public boolean reorderTracks(UUID playlistId, UUID userId, List<UUID> trackIds) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
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
    public Optional<PlaylistCollaborator> inviteCollaborator(UUID playlistId, UUID ownerId, String username, String permission) {
        Playlist playlist = playlistJooqRepository.findById(playlistId)
            .orElseThrow(() -> new ResourceNotFoundException("The playlist does not exist."));

        if (!hasFullControl(playlist, ownerId)) {
            throw new ForbiddenException("You do not have permission to manage collaborators.");
        }

        if (username == null || username.isBlank()) {
            throw new BadRequestException("The username is required.");
        }

        UUID inviteeId = userJooqRepository.findByUsernameIgnoreCase(username.trim())
            .map(user -> user.getId())
            .orElseThrow(() -> new UnprocessableEntityException("No user has that username."));

        if (inviteeId.equals(ownerId)) {
            throw new BadRequestException("You cannot invite yourself.");
        }

        if (collaboratorRepository.findByPlaylistIdAndUserId(playlistId, inviteeId).isPresent()) {
            return Optional.empty();
        }

        PlaylistCollaborator collab = PlaylistCollaborator.builder()
            .playlistId(playlistId)
            .userId(inviteeId)
            .permission(permission != null ? permission : "view")
            .status("pending")
            .invitedBy(ownerId)
            .build();
        return Optional.of(collaboratorRepository.save(collab));
    }

    @Transactional(readOnly = true)
    public Optional<List<CollaboratorDto>> getCollaborators(UUID playlistId, UUID viewerId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(playlist -> canView(playlist, viewerId))
            .map(playlist -> collaboratorRepository.findByPlaylistId(playlistId).stream()
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
                .collect(Collectors.toList()));
    }

    @Transactional
    public Optional<PlaylistCollaborator> updateCollaborator(UUID playlistId, UUID userId, UUID collaboratorId, String permission) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasFullControl(p, userId))
            .flatMap(p -> collaboratorRepository.findById(collaboratorId))
            .filter(collab -> collab.getPlaylistId().equals(playlistId))
            .map(collab -> {
                collab.setPermission(permission);
                return collaboratorRepository.save(collab);
            });
    }

    @Transactional
    public boolean removeCollaborator(UUID playlistId, UUID userId, UUID collaboratorId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasFullControl(p, userId))
            .flatMap(p -> collaboratorRepository.findById(collaboratorId))
            .filter(collab -> collab.getPlaylistId().equals(playlistId))
            .map(collab -> {
                collaboratorRepository.delete(collab);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<Playlist> generateShareToken(UUID playlistId, UUID userId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
            .map(playlist -> {
                playlist.setShareToken(UUID.randomUUID().toString());
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistJooqRepository.update(playlist);
            });
    }

    @Transactional
    public boolean invalidateShareToken(UUID playlistId, UUID userId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> hasEditAccess(p, userId))
            .map(playlist -> {
                playlist.setShareToken(null);
                playlist.setUpdatedAt(OffsetDateTime.now());
                playlistJooqRepository.update(playlist);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<Playlist> transferOwnership(UUID playlistId, UUID userId, UUID newOwnerId) {
        return playlistJooqRepository.findById(playlistId)
            .filter(p -> userId.equals(p.getUserId()))
            .filter(p -> !newOwnerId.equals(userId))
            .map(playlist -> {
                // Add former owner as edit collaborator if not already a collaborator
                if (collaboratorRepository.findByPlaylistIdAndUserId(playlistId, userId).isEmpty()) {
                    PlaylistCollaborator formerOwnerCollab = PlaylistCollaborator.builder()
                        .playlistId(playlistId)
                        .userId(userId)
                        .permission("edit")
                        .status("accepted")
                        .invitedBy(userId)
                        .build();
                    collaboratorRepository.save(formerOwnerCollab);
                } else {
                    collaboratorRepository.findByPlaylistIdAndUserId(playlistId, userId)
                        .ifPresent(c -> {
                            c.setPermission("edit");
                            c.setStatus("accepted");
                            collaboratorRepository.save(c);
                        });
                }
                // Remove new owner from collaborators if they are one
                collaboratorRepository.findByPlaylistIdAndUserId(playlistId, newOwnerId)
                    .ifPresent(collaboratorRepository::delete);
                // Transfer ownership
                playlist.setUserId(newOwnerId);
                playlist.setUpdatedAt(OffsetDateTime.now());
                return playlistJooqRepository.update(playlist);
            });
    }

    private String getDisplayNameForUser(UUID userId) {
        if (userId == null) return null;
        return userJooqRepository.findById(userId)
            .map(u -> u.getDisplayName())
            .orElse(null);
    }
}
