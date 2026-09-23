package se.dansbart.domain.dancelist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.CollaborationAccess;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dance.DanceService;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.group.GroupMember;
import se.dansbart.domain.group.GroupMemberJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.DanceListDto;
import se.dansbart.dto.DanceListEntryDto;
import se.dansbart.dto.GroupSummaryDto;
import se.dansbart.dto.PlaylistTrackDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.UserSummaryDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;

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

    private final DanceListJooqRepository danceListJooqRepository;
    private final DanceListEntryJooqRepository entryJooqRepository;
    private final DanceListEntryTrackJooqRepository entryTrackJooqRepository;
    private final DanceListCollaboratorJooqRepository collaboratorRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final UserJooqRepository userJooqRepository;
    private final GroupJooqRepository groupJooqRepository;
    private final GroupMemberJooqRepository groupMemberJooqRepository;
    private final DanceJooqRepository danceJooqRepository;
    private final DanceService danceService;
    private final CollaborationAccess collaborationAccess;

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
    public List<DanceList> findByUserId(UUID userId) {
        return danceListJooqRepository.findByUserId(userId);
    }

    @Transactional(readOnly = true)
    public Optional<DanceListDto> findByIdAsDto(UUID danceListId, UUID viewerId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> canView(danceList, viewerId))
            .map(this::toDanceListDto);
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
            () -> collaboratorRepository.existsByDanceListIdAndUserIdAndPermission(danceList.getId(), userId, "edit"));
    }

    private boolean canView(DanceList danceList, UUID viewerId) {
        return collaborationAccess.canView(Boolean.TRUE.equals(danceList.getIsPublic()), danceList.getGroupId(), viewerId,
            () -> hasEditAccess(danceList, viewerId),
            () -> collaboratorRepository.findByDanceListIdAndUserId(danceList.getId(), viewerId)
                .filter(c -> "accepted".equals(c.getStatus()))
                .isPresent());
    }

    private DanceListDto toDanceListDto(DanceList danceList) {
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

        List<DanceListEntryDto> entries = danceListEntries.stream()
            .map(entry -> buildDanceListEntryDto(entry,
                entry.getDanceId() != null ? danceNamesById.get(entry.getDanceId()) : null,
                linksByEntryId.get(entry.getId()), trackDtosById))
            .collect(Collectors.toList());
        return DanceListDto.builder()
            .id(danceList.getId())
            .name(danceList.getName())
            .description(danceList.getDescription())
            .isPublic(danceList.getIsPublic())
            .createdAt(danceList.getCreatedAt())
            .updatedAt(danceList.getUpdatedAt())
            .owner(owner)
            .ownerGroup(ownerGroup)
            .entries(entries)
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
            .playMode(entry.getPlayMode())
            .position(entry.getPosition())
            .tracks(trackListDtos)
            .build();
    }
}
