package se.dansbart.domain.dancelist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.CollaborationAccess;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dance.DanceService;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.group.GroupMember;
import se.dansbart.domain.group.GroupMemberJooqRepository;
import se.dansbart.domain.guestcode.GuestCodeJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.track.UserTrackSourceJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.CollaboratorDto;
import se.dansbart.dto.DanceListDto;
import se.dansbart.dto.DanceListEntryDto;
import se.dansbart.dto.DanceListInvitationDto;
import se.dansbart.dto.DanceListListItemDto;
import se.dansbart.dto.PageResponse;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.PlaylistTrackDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.UserSummaryDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;
import se.dansbart.exception.UnprocessableEntityException;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DanceListService {

    private static final Set<String> PLAY_MODES = Set.of("in_order", "random");
    private static final Set<String> PERMISSIONS = Set.of("view", "edit");
    private static final int MAX_ENTRY_NAME_LENGTH = 200;
    private static final int MAX_ENTRY_DESCRIPTION_LENGTH = 5000;
    private static final int MAX_ENTRY_DESCRIPTION_URL_LENGTH = 2000;

    private final DanceListJooqRepository danceListJooqRepository;
    private final DanceListEntryJooqRepository entryJooqRepository;
    private final DanceListEntryTrackJooqRepository entryTrackJooqRepository;
    private final DanceListCollaboratorJooqRepository collaboratorRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final UserTrackSourceJooqRepository sourceRepository;
    private final UserJooqRepository userJooqRepository;
    private final GroupJooqRepository groupJooqRepository;
    private final GroupMemberJooqRepository groupMemberJooqRepository;
    private final DanceJooqRepository danceJooqRepository;
    private final DanceService danceService;
    private final CollaborationAccess collaborationAccess;
    private final GuestCodeJooqRepository guestCodeJooqRepository;

    @Transactional
    public DanceList create(UUID userId, String name, String description, Boolean isPublic) {
        DanceList danceList = DanceList.builder()
            .userId(userId)
            .name(name)
            .description(description)
            .isPublic(isPublic != null && isPublic)
            .build();
        return danceListJooqRepository.insert(danceList);
    }

    @Transactional
    public DanceList createForGroup(UUID groupId, UUID userId, String name, String description, Boolean isPublic) {
        boolean groupIsVisible = groupJooqRepository.findById(groupId)
            .map(group -> Boolean.TRUE.equals(group.getIsPublic())
                || groupMemberJooqRepository.findByGroupIdAndUserId(groupId, userId).map(GroupMember::isAccepted).orElse(false))
            .orElse(false);
        if (!groupIsVisible) {
            throw new ResourceNotFoundException("The group does not exist, or you do not have access to it.");
        }
        boolean canManagePlaylists = groupMemberJooqRepository.findByGroupIdAndUserId(groupId, userId)
            .map(GroupMember::canManagePlaylists)
            .orElse(false);
        if (!canManagePlaylists) {
            throw new ForbiddenException("You do not have permission to create dance lists for this group.");
        }
        DanceList danceList = DanceList.builder()
            .groupId(groupId)
            .name(name)
            .description(description)
            .isPublic(isPublic != null && isPublic)
            .build();
        return danceListJooqRepository.insert(danceList);
    }

    @Transactional(readOnly = true)
    public List<DanceList> findVisibleToUser(UUID userId) {
        return danceListJooqRepository.findVisibleToUser(userId);
    }

    @Transactional(readOnly = true)
    public PageResponse<DanceListListItemDto> findPublicDanceLists(int page, int size) {
        int clampedSize = Math.min(Math.max(size, 1), 50);
        int clampedPage = Math.max(page, 0);
        List<DanceListListItemDto> all = danceListJooqRepository.findPublic().stream()
            .map(record -> DanceListListItemDto.builder()
                .id(record.danceList().getId())
                .name(record.danceList().getName())
                .description(record.danceList().getDescription())
                .isPublic(record.danceList().getIsPublic())
                .entryCount(record.entryCount())
                .ownerGroup(record.danceList().getGroupId() != null
                    ? GroupSummaryDto.builder().id(record.danceList().getGroupId()).name(record.groupName()).build()
                    : null)
                .ownerDisplayName(record.ownerDisplayName())
                .build())
            .collect(Collectors.toList());
        long total = all.size();
        int fromIndex = Math.min(clampedPage * clampedSize, all.size());
        int toIndex = Math.min(fromIndex + clampedSize, all.size());
        boolean hasMore = (long) (clampedPage + 1) * clampedSize < total;
        return new PageResponse<>(all.subList(fromIndex, toIndex), total, clampedPage, clampedSize, hasMore);
    }

    @Transactional(readOnly = true)
    public List<DanceList> findEditableByUser(UUID userId) {
        return danceListJooqRepository.findEditableByUser(userId);
    }

    @Transactional(readOnly = true)
    public Optional<DanceListDto> findByIdAsDto(UUID danceListId, UUID viewerId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> canView(danceList, viewerId))
            .map(danceList -> toDanceListDto(danceList, viewerId));
    }

    @Transactional
    public DanceList update(UUID danceListId, UUID userId, String name, String description, Boolean isPublic) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        boolean fullControl = hasFullControl(danceList, userId);
        if (name != null) danceList.setName(name);
        if (fullControl) {
            if (description != null) danceList.setDescription(description);
            if (isPublic != null) danceList.setIsPublic(isPublic);
        }
        danceList.setUpdatedAt(OffsetDateTime.now());
        return danceListJooqRepository.update(danceList);
    }

    @Transactional
    public void delete(UUID danceListId, UUID userId) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireFullControl(danceList, userId);
        for (DanceListEntry entry : entryJooqRepository.findByDanceListIdOrderByPosition(danceListId)) {
            withdrawVotesForEntry(entry);
        }
        danceListJooqRepository.delete(danceListId);
    }

    @Transactional
    public DanceListEntryDto addEntry(UUID danceListId, UUID userId, UUID danceId, String freeTextName) {
        if (danceId == null && (freeTextName == null || freeTextName.isBlank())) {
            throw new BadRequestException("Give a dance from the site, or a name for the dance.");
        }
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        if (danceId != null && entryJooqRepository.existsByDanceListIdAndDanceId(danceListId, danceId)) {
            throw new ConflictException("This dance is already in the list.");
        }
        int nextPosition = entryJooqRepository.count(danceListId);
        DanceListEntry entry = DanceListEntry.builder()
            .danceListId(danceListId)
            .danceId(danceId)
            .freeTextName(danceId == null ? freeTextName : null)
            .position(nextPosition)
            .build();
        entryJooqRepository.insert(entry);
        return toDanceListEntryDto(entry);
    }

    @Transactional
    public void removeEntry(UUID danceListId, UUID userId, UUID entryId) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        DanceListEntry entry = requireOwnEntry(danceListId, entryId);
        withdrawVotesForEntry(entry);
        entryJooqRepository.delete(entryId);
        reorderEntryPositions(danceListId);
    }

    @Transactional
    public void reorderEntries(UUID danceListId, UUID userId, List<UUID> entryIds) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        Set<UUID> ownEntryIds = entryJooqRepository.findByDanceListIdOrderByPosition(danceListId).stream()
            .map(DanceListEntry::getId)
            .collect(Collectors.toSet());
        for (UUID entryId : entryIds) {
            if (!ownEntryIds.contains(entryId)) {
                throw new ResourceNotFoundException("This entry is not part of the dance list.");
            }
        }
        for (int i = 0; i < entryIds.size(); i++) {
            entryJooqRepository.updatePosition(entryIds.get(i), i);
        }
    }

    @Transactional
    public void setPlayMode(UUID danceListId, UUID userId, UUID entryId, String playMode) {
        if (!PLAY_MODES.contains(playMode)) {
            throw new BadRequestException("Play mode must be 'in_order' or 'random'.");
        }
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        requireOwnEntry(danceListId, entryId);
        entryJooqRepository.updatePlayMode(entryId, playMode);
    }

    /**
     * Gives an entry a name of the person's own choosing. A dance from the site stays
     * linked to that dance; the name is shown in its place.
     */
    @Transactional
    public void renameEntry(UUID danceListId, UUID userId, UUID entryId, String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("Give the dance a name.");
        }
        if (trimmed.length() > MAX_ENTRY_NAME_LENGTH) {
            throw new BadRequestException("The name can be at most " + MAX_ENTRY_NAME_LENGTH + " characters.");
        }
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        requireOwnEntry(danceListId, entryId);
        entryJooqRepository.updateFreeTextName(entryId, trimmed);
    }

    /**
     * Sets what the list says about a dance: a text of the person's own, and a link to a
     * description elsewhere. A blank value removes that part. The dance of the site is not changed.
     */
    @Transactional
    public DanceListEntryDto describeEntry(UUID danceListId, UUID userId, UUID entryId,
                                           String description, String descriptionUrl) {
        String text = description == null || description.isBlank() ? null : description.strip();
        if (text != null && text.length() > MAX_ENTRY_DESCRIPTION_LENGTH) {
            throw new BadRequestException(
                "The description can be at most " + MAX_ENTRY_DESCRIPTION_LENGTH + " characters.");
        }
        String url = descriptionUrl == null || descriptionUrl.isBlank() ? null : descriptionUrl.strip();
        if (url != null && !isWebAddress(url)) {
            throw new BadRequestException("The link must be a web address that starts with http:// or https://.");
        }
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        DanceListEntry entry = requireOwnEntry(danceListId, entryId);
        entryJooqRepository.updateDescription(entryId, text, url);
        entry.setDescription(text);
        entry.setDescriptionUrl(url);
        return toDanceListEntryDto(entry);
    }

    /** Only http and https, so the link is safe to show as a link to everyone who sees the list. */
    private static boolean isWebAddress(String url) {
        if (url.length() > MAX_ENTRY_DESCRIPTION_URL_LENGTH) {
            return false;
        }
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            return scheme != null
                && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                && uri.getHost() != null;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    @Transactional
    public DanceListEntryTrack addTrackToEntry(UUID danceListId, UUID userId, UUID entryId, UUID trackId) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        DanceListEntry entry = requireOwnEntry(danceListId, entryId);
        trackJooqRepository.findById(trackId)
            .orElseThrow(() -> new ResourceNotFoundException("The track does not exist."));
        int nextPosition = entryTrackJooqRepository.count(entryId);
        boolean castsVote = entry.getDanceId() != null;
        DanceListEntryTrack link = DanceListEntryTrack.builder()
            .entryId(entryId)
            .trackId(trackId)
            .position(nextPosition)
            .voterId(userId)
            .voteCast(castsVote)
            .build();
        entryTrackJooqRepository.insert(link);
        if (castsVote) {
            danceService.castVoteAsVoter(entry.getDanceId(), trackId, userId, 1);
        }
        return link;
    }

    @Transactional
    public void removeTrackFromEntry(UUID danceListId, UUID userId, UUID entryId, UUID trackId) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        DanceListEntry entry = requireOwnEntry(danceListId, entryId);
        entryTrackJooqRepository.findByEntryIdAndTrackId(entryId, trackId).ifPresent(link -> {
            if (Boolean.TRUE.equals(link.getVoteCast())) {
                danceService.withdrawVoteAsVoter(entry.getDanceId(), trackId, link.getVoterId());
            }
        });
        entryTrackJooqRepository.deleteByEntryIdAndTrackId(entryId, trackId);
        reorderEntryTrackPositions(entryId);
    }

    @Transactional
    public void reorderEntryTracks(UUID danceListId, UUID userId, UUID entryId, List<UUID> trackIds) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireEditAccess(danceList, userId);
        requireOwnEntry(danceListId, entryId);
        List<DanceListEntryTrack> links = entryTrackJooqRepository.findByEntryIdOrderByPosition(entryId);
        for (int i = 0; i < trackIds.size(); i++) {
            UUID trackId = trackIds.get(i);
            for (DanceListEntryTrack link : links) {
                if (link.getTrackId().equals(trackId)) {
                    entryTrackJooqRepository.updatePosition(link.getId(), i);
                    break;
                }
            }
        }
    }

    private DanceList requireVisible(UUID danceListId, UUID userId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> canView(danceList, userId))
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist, or you do not have access to it."));
    }

    private void requireEditAccess(DanceList danceList, UUID userId) {
        if (!hasEditAccess(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to change this dance list.");
        }
    }

    private void requireFullControl(DanceList danceList, UUID userId) {
        if (!hasFullControl(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to change this dance list.");
        }
    }

    private DanceListEntry requireOwnEntry(UUID danceListId, UUID entryId) {
        return entryJooqRepository.findById(entryId)
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .orElseThrow(() -> new ResourceNotFoundException("This entry is not part of the dance list."));
    }

    private void withdrawVotesForEntry(DanceListEntry entry) {
        if (entry.getDanceId() == null) {
            return;
        }
        for (DanceListEntryTrack link : entryTrackJooqRepository.findByEntryIdOrderByPosition(entry.getId())) {
            if (Boolean.TRUE.equals(link.getVoteCast())) {
                danceService.withdrawVoteAsVoter(entry.getDanceId(), link.getTrackId(), link.getVoterId());
            }
        }
    }

    private void reorderEntryPositions(UUID danceListId) {
        List<DanceListEntry> entries = entryJooqRepository.findByDanceListIdOrderByPosition(danceListId);
        for (int i = 0; i < entries.size(); i++) {
            entryJooqRepository.updatePosition(entries.get(i).getId(), i);
        }
    }

    private void reorderEntryTrackPositions(UUID entryId) {
        List<DanceListEntryTrack> links = entryTrackJooqRepository.findByEntryIdOrderByPosition(entryId);
        for (int i = 0; i < links.size(); i++) {
            entryTrackJooqRepository.updatePosition(links.get(i).getId(), i);
        }
    }

    private boolean hasFullControl(DanceList danceList, UUID userId) {
        return collaborationAccess.hasFullControl(danceList.getUserId(), danceList.getGroupId(), userId);
    }

    private boolean hasEditAccess(DanceList danceList, UUID userId) {
        return collaborationAccess.hasEditAccess(danceList.getUserId(), danceList.getGroupId(), userId,
            () -> collaboratorRepository.existsByDanceListIdAndUserIdAndPermission(danceList.getId(), userId, "edit")
                || collaboratorRepository.hasAcceptedGroupCollaboration(danceList.getId(), userId, "edit"));
    }

    private boolean canView(DanceList danceList, UUID viewerId) {
        return collaborationAccess.canView(Boolean.TRUE.equals(danceList.getIsPublic()), danceList.getGroupId(), viewerId,
            () -> hasEditAccess(danceList, viewerId),
            () -> collaboratorRepository.findByDanceListIdAndUserId(danceList.getId(), viewerId)
                .filter(c -> "accepted".equals(c.getStatus()))
                .isPresent()
                || collaboratorRepository.hasAcceptedGroupCollaboration(danceList.getId(), viewerId, null));
    }

    private DanceListDto toDanceListDto(DanceList danceList, UUID viewerId) {
        UserSummaryDto owner = danceList.getUserId() != null
            ? userJooqRepository.findById(danceList.getUserId())
                .map(u -> UserSummaryDto.builder()
                    .id(u.getId())
                    .username(u.getUsername())
                    .displayName(u.getDisplayName())
                    .avatarUrl(u.getAvatarUrl())
                    .build())
                .orElse(null)
            : null;
        GroupSummaryDto ownerGroup = danceList.getGroupId() != null
            ? groupJooqRepository.findById(danceList.getGroupId())
                .map(g -> GroupSummaryDto.builder().id(g.getId()).name(g.getName()).build())
                .orElse(null)
            : null;
        Boolean viewerCanManage = viewerId != null ? hasEditAccess(danceList, viewerId) : null;
        Boolean viewerHasFullControl = viewerId != null ? hasFullControl(danceList, viewerId) : null;
        boolean includeShareToken = viewerId == null || hasEditAccess(danceList, viewerId);
        List<DanceListEntry> danceListEntries = entryJooqRepository.findByDanceListIdOrderByPosition(danceList.getId());

        List<UUID> danceIds = danceListEntries.stream()
            .map(DanceListEntry::getDanceId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        Map<UUID, String> danceNamesById = danceJooqRepository.findNamesByIds(danceIds);

        Map<UUID, List<DanceListEntryTrack>> linksByEntryId = danceListEntries.stream()
            .collect(Collectors.toMap(DanceListEntry::getId,
                entry -> entryTrackJooqRepository.findByEntryIdOrderByPosition(entry.getId())));
        List<UUID> trackIds = linksByEntryId.values().stream()
            .flatMap(List::stream)
            .map(DanceListEntryTrack::getTrackId)
            .distinct()
            .toList();
        Map<UUID, TrackListDto> trackDtosById = trackJooqRepository.findTrackListDtosByIds(trackIds).stream()
            .collect(Collectors.toMap(TrackListDto::getId, trackDto -> trackDto));
        // The viewer's own library tracks play from the viewer's own file.
        for (UUID heldId : sourceRepository.findTrackIdsHeldBy(trackIds, viewerId)) {
            TrackListDto held = trackDtosById.get(heldId);
            if (held != null) held.setPlayable(true);
        }

        List<DanceListEntryDto> entries = danceListEntries.stream()
            .map(entry -> buildDanceListEntryDto(entry,
                entry.getDanceId() != null ? danceNamesById.get(entry.getDanceId()) : null,
                linksByEntryId.get(entry.getId()), trackDtosById))
            .collect(Collectors.toList());

        List<CollaboratorDto> collaborators = collaboratorRepository.findByDanceListId(danceList.getId()).stream()
            .map(this::toCollaboratorDto)
            .collect(Collectors.toList());

        return DanceListDto.builder()
            .id(danceList.getId())
            .name(danceList.getName())
            .description(danceList.getDescription())
            .isPublic(danceList.getIsPublic())
            .shareToken(includeShareToken ? danceList.getShareToken() : null)
            .guestCode(Boolean.TRUE.equals(viewerHasFullControl)
                ? guestCodeJooqRepository.findCodeByDanceListId(danceList.getId()).orElse(null)
                : null)
            .createdAt(danceList.getCreatedAt())
            .updatedAt(danceList.getUpdatedAt())
            .owner(owner)
            .ownerGroup(ownerGroup)
            .viewerCanManage(viewerCanManage)
            .viewerHasFullControl(viewerHasFullControl)
            .entries(entries)
            .collaborators(collaborators)
            .build();
    }

    private DanceListEntryDto toDanceListEntryDto(DanceListEntry entry) {
        String danceName = entry.getDanceId() != null
            ? danceJooqRepository.findById(entry.getDanceId()).map(dance -> dance.getName()).orElse(null)
            : null;
        List<DanceListEntryTrack> links = entryTrackJooqRepository.findByEntryIdOrderByPosition(entry.getId());
        List<UUID> trackIds = links.stream().map(DanceListEntryTrack::getTrackId).distinct().toList();
        Map<UUID, TrackListDto> trackDtosById = trackJooqRepository.findTrackListDtosByIds(trackIds).stream()
            .collect(Collectors.toMap(TrackListDto::getId, trackDto -> trackDto));
        return buildDanceListEntryDto(entry, danceName, links, trackDtosById);
    }

    private DanceListEntryDto buildDanceListEntryDto(DanceListEntry entry, String danceName,
                                                       List<DanceListEntryTrack> links, Map<UUID, TrackListDto> trackDtosById) {
        List<PlaylistTrackDto> trackListDtos = links.stream()
            .map(link -> PlaylistTrackDto.builder()
                .id(link.getId())
                .position(link.getPosition())
                .addedAt(link.getCreatedAt())
                .track(trackDtosById.get(link.getTrackId()))
                .build())
            .collect(Collectors.toList());
        return DanceListEntryDto.builder()
            .id(entry.getId())
            .danceId(entry.getDanceId())
            .danceName(danceName)
            .freeTextName(entry.getFreeTextName())
            .description(entry.getDescription())
            .descriptionUrl(entry.getDescriptionUrl())
            .playMode(entry.getPlayMode())
            .position(entry.getPosition())
            .addedByGuest(Boolean.TRUE.equals(entry.getAddedByGuest()))
            .tracks(trackListDtos)
            .build();
    }

    @Transactional(readOnly = true)
    public Optional<DanceList> findByShareToken(String shareToken) {
        return danceListJooqRepository.findByShareToken(shareToken);
    }

    @Transactional(readOnly = true)
    public Optional<DanceListDto> findByShareTokenAsDto(String shareToken) {
        return danceListJooqRepository.findByShareToken(shareToken)
            .map(danceList -> toDanceListDto(danceList, null));
    }

    @Transactional
    public Optional<DanceListCollaborator> inviteCollaborator(UUID danceListId, UUID ownerId, String username,
                                                              String groupName, String permission) {
        if (permission != null && !PERMISSIONS.contains(permission)) {
            throw new BadRequestException("Permission must be 'view' or 'edit'.");
        }
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));
        if (!hasFullControl(danceList, ownerId)) {
            throw new ForbiddenException("You do not have permission to manage collaborators.");
        }

        boolean hasUsername = username != null && !username.isBlank();
        boolean hasGroupName = groupName != null && !groupName.isBlank();
        if (hasUsername == hasGroupName) {
            throw new BadRequestException("Invite exactly one of a username or a group name.");
        }

        DanceListCollaborator.DanceListCollaboratorBuilder collab = DanceListCollaborator.builder()
            .danceListId(danceListId)
            .permission(permission != null ? permission : "view")
            .status("pending")
            .invitedBy(ownerId);

        if (hasGroupName) {
            UUID groupId = groupJooqRepository.findByNameIgnoreCase(groupName.trim())
                .map(group -> group.getId())
                .orElseThrow(() -> new UnprocessableEntityException("No group has that name."));
            if (groupId.equals(danceList.getGroupId())) {
                throw new BadRequestException("The group already owns this dance list.");
            }
            if (collaboratorRepository.findByDanceListIdAndGroupId(danceListId, groupId).isPresent()) {
                return Optional.empty();
            }
            return Optional.of(collaboratorRepository.save(collab.groupId(groupId).build()));
        }

        UUID inviteeId = userJooqRepository.findByUsernameIgnoreCase(username.trim())
            .map(user -> user.getId())
            .orElseThrow(() -> new UnprocessableEntityException("No user has that username."));
        if (inviteeId.equals(ownerId)) {
            throw new BadRequestException("You cannot invite yourself.");
        }
        if (collaboratorRepository.findByDanceListIdAndUserId(danceListId, inviteeId).isPresent()) {
            return Optional.empty();
        }
        return Optional.of(collaboratorRepository.save(collab.userId(inviteeId).build()));
    }

    @Transactional(readOnly = true)
    public Optional<List<CollaboratorDto>> getCollaborators(UUID danceListId, UUID viewerId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> canView(danceList, viewerId))
            .map(danceList -> collaboratorRepository.findByDanceListId(danceListId).stream()
                .map(this::toCollaboratorDto)
                .collect(Collectors.toList()));
    }

    @Transactional(readOnly = true)
    public List<DanceListInvitationDto> getPendingInvitations(UUID userId) {
        return collaboratorRepository.findByUserIdAndStatus(userId, "pending").stream()
            .map(collab -> DanceListInvitationDto.builder()
                .id(collab.getId())
                .danceListId(collab.getDanceListId())
                .danceListName(danceListJooqRepository.findById(collab.getDanceListId())
                    .map(DanceList::getName).orElse(null))
                .invitedByUserId(collab.getInvitedBy())
                .invitedByDisplayName(displayNameOf(collab.getInvitedBy()))
                .permission(collab.getPermission())
                .invitedAt(collab.getInvitedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<DanceListCollaborator> respondToInvitation(UUID invitationId, UUID userId, boolean accept) {
        DanceListCollaborator collab = collaboratorRepository.findById(invitationId)
            .filter(c -> userId.equals(c.getUserId()) && "pending".equals(c.getStatus()))
            .orElseThrow(() -> new ResourceNotFoundException("This invitation does not exist."));
        return answer(collab, accept);
    }

    @Transactional(readOnly = true)
    public List<DanceListInvitationDto> getPendingInvitationsForGroup(UUID groupId, UUID viewerId) {
        requireGroupAdmin(groupId, viewerId);
        return collaboratorRepository.findByGroupIdAndStatus(groupId, "pending").stream()
            .map(invitation -> DanceListInvitationDto.builder()
                .id(invitation.id())
                .danceListId(invitation.danceListId())
                .danceListName(invitation.danceListName())
                .invitedByUserId(invitation.invitedByUserId())
                .invitedByDisplayName(invitation.invitedByDisplayName())
                .permission(invitation.permission())
                .invitedAt(invitation.invitedAt())
                .build())
            .collect(Collectors.toList());
    }

    @Transactional
    public Optional<DanceListCollaborator> respondToGroupInvitation(UUID groupId, UUID invitationId, UUID viewerId,
                                                                    boolean accept) {
        requireGroupAdmin(groupId, viewerId);
        DanceListCollaborator collab = collaboratorRepository.findById(invitationId)
            .filter(c -> groupId.equals(c.getGroupId()) && "pending".equals(c.getStatus()))
            .orElseThrow(() -> new ResourceNotFoundException("This invitation does not exist."));
        return answer(collab, accept);
    }

    private Optional<DanceListCollaborator> answer(DanceListCollaborator collab, boolean accept) {
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
    public Optional<DanceListCollaborator> updateCollaborator(UUID danceListId, UUID userId, UUID collaboratorId, String permission) {
        if (!PERMISSIONS.contains(permission)) {
            throw new BadRequestException("Permission must be 'view' or 'edit'.");
        }
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));
        if (!hasFullControl(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to manage collaborators.");
        }
        return collaboratorRepository.findById(collaboratorId)
            .filter(collab -> danceListId.equals(collab.getDanceListId()))
            .map(collab -> {
                collab.setPermission(permission);
                return collaboratorRepository.save(collab);
            });
    }

    @Transactional
    public boolean removeCollaborator(UUID danceListId, UUID userId, UUID collaboratorId) {
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));
        if (!hasFullControl(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to manage collaborators.");
        }
        return collaboratorRepository.findById(collaboratorId)
            .filter(collab -> danceListId.equals(collab.getDanceListId()))
            .map(collab -> {
                collaboratorRepository.delete(collab);
                return true;
            })
            .orElse(false);
    }

    private CollaboratorDto toCollaboratorDto(DanceListCollaborator collab) {
        var user = collab.getUser();
        var group = collab.getGroup();
        return CollaboratorDto.builder()
            .id(collab.getId())
            .userId(collab.getUserId())
            .username(user != null ? user.getUsername() : null)
            .displayName(user != null ? user.getDisplayName() : null)
            .groupId(group != null ? group.getId() : null)
            .groupName(group != null ? group.getName() : null)
            .permission(collab.getPermission())
            .status(collab.getStatus())
            .invitedAt(collab.getInvitedAt())
            .acceptedAt(collab.getAcceptedAt())
            .build();
    }

    private String displayNameOf(UUID userId) {
        if (userId == null) return null;
        return userJooqRepository.findById(userId).map(u -> u.getDisplayName()).orElse(null);
    }

    @Transactional
    public Optional<DanceList> generateShareToken(UUID danceListId, UUID userId) {
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));

        if (!hasEditAccess(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to manage share tokens.");
        }

        danceList.setShareToken(UUID.randomUUID().toString());
        danceList.setUpdatedAt(OffsetDateTime.now());
        return Optional.of(danceListJooqRepository.update(danceList));
    }

    @Transactional
    public boolean invalidateShareToken(UUID danceListId, UUID userId) {
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));

        if (!hasEditAccess(danceList, userId)) {
            throw new ForbiddenException("You do not have permission to manage share tokens.");
        }

        danceList.setShareToken(null);
        danceList.setUpdatedAt(OffsetDateTime.now());
        danceListJooqRepository.update(danceList);
        return true;
    }

    @Transactional
    public DanceList transferOwnership(UUID danceListId, UUID userId, UUID newOwnerId) {
        DanceList danceList = requireVisible(danceListId, userId);
        requireFullControl(danceList, userId);
        if (danceList.getUserId() == null) {
            throw new ResourceNotFoundException("The dance list does not exist, or you do not have access to it.");
        }
        boolean newOwnerIsAcceptedCollaborator = collaboratorRepository.findByDanceListIdAndUserId(danceListId, newOwnerId)
            .filter(c -> "accepted".equals(c.getStatus()))
            .isPresent();
        if (!newOwnerIsAcceptedCollaborator) {
            throw new BadRequestException("The new owner must be an accepted collaborator on this dance list.");
        }
        if (collaboratorRepository.findByDanceListIdAndUserId(danceListId, userId).isEmpty()) {
            DanceListCollaborator formerOwnerCollab = DanceListCollaborator.builder()
                .danceListId(danceListId)
                .userId(userId)
                .permission("edit")
                .status("accepted")
                .invitedBy(userId)
                .build();
            collaboratorRepository.save(formerOwnerCollab);
        } else {
            collaboratorRepository.findByDanceListIdAndUserId(danceListId, userId)
                .ifPresent(c -> {
                    c.setPermission("edit");
                    c.setStatus("accepted");
                    collaboratorRepository.save(c);
                });
        }
        collaboratorRepository.findByDanceListIdAndUserId(danceListId, newOwnerId)
            .ifPresent(collaboratorRepository::delete);
        danceList.setUserId(newOwnerId);
        danceList.setUpdatedAt(OffsetDateTime.now());
        return danceListJooqRepository.update(danceList);
    }
}
