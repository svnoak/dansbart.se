package se.dansbart.domain.dancelist;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

import java.time.OffsetDateTime;
import java.util.List;
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
    public DanceList createForGroup(UUID groupId, String name, String description, Boolean isPublic) {
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
    public Optional<DanceList> update(UUID danceListId, UUID userId, String name, String description, Boolean isPublic) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .map(danceList -> {
                boolean fullControl = hasFullControl(danceList, userId);
                if (name != null) danceList.setName(name);
                if (fullControl) {
                    if (description != null) danceList.setDescription(description);
                    if (isPublic != null) danceList.setIsPublic(isPublic);
                }
                danceList.setUpdatedAt(OffsetDateTime.now());
                return danceListJooqRepository.update(danceList);
            });
    }

    @Transactional
    public boolean delete(UUID danceListId, UUID userId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasFullControl(danceList, userId))
            .map(danceList -> {
                for (DanceListEntry entry : entryJooqRepository.findByDanceListIdOrderByPosition(danceListId)) {
                    withdrawVotesForEntry(entry);
                }
                danceListJooqRepository.delete(danceListId);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<DanceListEntryDto> addEntry(UUID danceListId, UUID userId, UUID danceId, String freeTextName) {
        if (danceId == null && (freeTextName == null || freeTextName.isBlank())) {
            throw new BadRequestException("Give a dance from the site, or a name for the dance.");
        }
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .map(danceList -> {
                if (danceId != null) {
                    if (entryJooqRepository.existsByDanceListIdAndDanceId(danceListId, danceId)) {
                        throw new ConflictException("This dance is already in the list.");
                    }
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
            });
    }

    @Transactional
    public boolean removeEntry(UUID danceListId, UUID userId, UUID entryId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .flatMap(danceList -> entryJooqRepository.findById(entryId))
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .map(entry -> {
                withdrawVotesForEntry(entry);
                entryJooqRepository.delete(entryId);
                reorderEntryPositions(danceListId);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public boolean reorderEntries(UUID danceListId, UUID userId, List<UUID> entryIds) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .map(danceList -> {
                for (int i = 0; i < entryIds.size(); i++) {
                    entryJooqRepository.updatePosition(entryIds.get(i), i);
                }
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public boolean setPlayMode(UUID danceListId, UUID userId, UUID entryId, String playMode) {
        if (!PLAY_MODES.contains(playMode)) {
            throw new BadRequestException("Play mode must be 'in_order' or 'random'.");
        }
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .flatMap(danceList -> entryJooqRepository.findById(entryId))
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .map(entry -> {
                entryJooqRepository.updatePlayMode(entryId, playMode);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<DanceListEntryTrack> addTrackToEntry(UUID danceListId, UUID userId, UUID entryId, UUID trackId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .flatMap(danceList -> entryJooqRepository.findById(entryId))
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .flatMap(entry -> trackJooqRepository.findById(trackId).map(track -> {
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
            }));
    }

    @Transactional
    public boolean removeTrackFromEntry(UUID danceListId, UUID userId, UUID entryId, UUID trackId) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .flatMap(danceList -> entryJooqRepository.findById(entryId))
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .map(entry -> {
                entryTrackJooqRepository.findByEntryIdAndTrackId(entryId, trackId).ifPresent(link -> {
                    if (Boolean.TRUE.equals(link.getVoteCast())) {
                        danceService.withdrawVoteAsVoter(entry.getDanceId(), trackId, link.getVoterId());
                    }
                });
                entryTrackJooqRepository.deleteByEntryIdAndTrackId(entryId, trackId);
                reorderEntryTrackPositions(entryId);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public boolean reorderEntryTracks(UUID danceListId, UUID userId, UUID entryId, List<UUID> trackIds) {
        return danceListJooqRepository.findById(danceListId)
            .filter(danceList -> hasEditAccess(danceList, userId))
            .flatMap(danceList -> entryJooqRepository.findById(entryId))
            .filter(entry -> entry.getDanceListId().equals(danceListId))
            .map(entry -> {
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
                return true;
            })
            .orElse(false);
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
        if (danceList.getGroupId() != null) {
            return groupMemberJooqRepository.findByGroupIdAndUserId(danceList.getGroupId(), userId)
                .map(GroupMember::canManagePlaylists)
                .orElse(false);
        }
        return userId.equals(danceList.getUserId());
    }

    private boolean hasEditAccess(DanceList danceList, UUID userId) {
        return hasFullControl(danceList, userId)
            || collaboratorRepository.existsByDanceListIdAndUserIdAndPermission(danceList.getId(), userId, "edit");
    }

    private boolean canView(DanceList danceList, UUID viewerId) {
        if (Boolean.TRUE.equals(danceList.getIsPublic())) {
            return true;
        }
        if (hasEditAccess(danceList, viewerId)) {
            return true;
        }
        if (collaboratorRepository.findByDanceListIdAndUserId(danceList.getId(), viewerId)
                .filter(c -> "accepted".equals(c.getStatus()))
                .isPresent()) {
            return true;
        }
        if (danceList.getGroupId() != null) {
            return groupMemberJooqRepository.findByGroupIdAndUserId(danceList.getGroupId(), viewerId)
                .map(GroupMember::isAccepted)
                .orElse(false);
        }
        return false;
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
        List<DanceListEntryDto> entries = entryJooqRepository.findByDanceListIdOrderByPosition(danceList.getId()).stream()
            .map(this::toDanceListEntryDto)
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
        List<UUID> trackIds = links.stream().map(DanceListEntryTrack::getTrackId).toList();
        List<TrackListDto> trackDtos = trackJooqRepository.findTrackListDtosByIds(trackIds);
        List<PlaylistTrackDto> trackListDtos = new java.util.ArrayList<>();
        for (int i = 0; i < links.size(); i++) {
            DanceListEntryTrack link = links.get(i);
            TrackListDto trackDto = i < trackDtos.size() ? trackDtos.get(i) : null;
            trackListDtos.add(PlaylistTrackDto.builder()
                .id(link.getId())
                .position(link.getPosition())
                .addedAt(link.getCreatedAt())
                .track(trackDto)
                .build());
        }
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
