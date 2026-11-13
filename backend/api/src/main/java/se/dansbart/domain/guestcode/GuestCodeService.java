package se.dansbart.domain.guestcode;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.CollaborationAccess;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dancelist.DanceList;
import se.dansbart.domain.dancelist.DanceListEntry;
import se.dansbart.domain.dancelist.DanceListEntryJooqRepository;
import se.dansbart.domain.dancelist.DanceListJooqRepository;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.playlist.PlaylistTrack;
import se.dansbart.domain.playlist.PlaylistTrackJooqRepository;
import se.dansbart.domain.track.PrivateTrackGuard;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.dto.GuestCodeDto;
import se.dansbart.dto.GuestListDto;
import se.dansbart.dto.GuestListDto.GuestDanceDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.exception.BadRequestException;
import se.dansbart.exception.ConflictException;
import se.dansbart.exception.ForbiddenException;
import se.dansbart.exception.ResourceNotFoundException;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Guest codes: a short code per playlist or dance list. Whoever has the code can see
 * what is in the list and add to it, and nothing else. The people with full control
 * of the list create and remove the code.
 */
@Service
@RequiredArgsConstructor
public class GuestCodeService {

    /** Letters and digits that are hard to mix up when read from a screen: no I, O, 0 or 1. */
    static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    static final int CODE_LENGTH = 6;
    static final int MAX_PLAYLIST_TRACKS = 500;
    static final int MAX_DANCE_LIST_ENTRIES = 300;
    private static final int MAX_ENTRY_NAME_LENGTH = 200;
    private static final String NOT_FOUND = "No list has this code.";

    private final GuestCodeJooqRepository guestCodeJooqRepository;
    private final PlaylistJooqRepository playlistJooqRepository;
    private final PlaylistTrackJooqRepository playlistTrackJooqRepository;
    private final DanceListJooqRepository danceListJooqRepository;
    private final DanceListEntryJooqRepository entryJooqRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final DanceJooqRepository danceJooqRepository;
    private final UserJooqRepository userJooqRepository;
    private final GroupJooqRepository groupJooqRepository;
    private final PrivateTrackGuard privateTrackGuard;
    private final CollaborationAccess collaborationAccess;

    private final SecureRandom random = new SecureRandom();

    // ===== Managing the code =====

    /** Creates the guest code of a playlist. A code that already exists is replaced, so the old one stops working. */
    @Transactional
    public GuestCodeDto createForPlaylist(UUID playlistId, UUID userId) {
        requireManagedPlaylist(playlistId, userId);
        guestCodeJooqRepository.deleteByPlaylistId(playlistId);
        String code = newCode();
        guestCodeJooqRepository.insert(code, playlistId, null, userId);
        return new GuestCodeDto(code);
    }

    @Transactional
    public void removeForPlaylist(UUID playlistId, UUID userId) {
        requireManagedPlaylist(playlistId, userId);
        guestCodeJooqRepository.deleteByPlaylistId(playlistId);
    }

    /** Creates the guest code of a dance list. A code that already exists is replaced, so the old one stops working. */
    @Transactional
    public GuestCodeDto createForDanceList(UUID danceListId, UUID userId) {
        requireManagedDanceList(danceListId, userId);
        guestCodeJooqRepository.deleteByDanceListId(danceListId);
        String code = newCode();
        guestCodeJooqRepository.insert(code, null, danceListId, userId);
        return new GuestCodeDto(code);
    }

    @Transactional
    public void removeForDanceList(UUID danceListId, UUID userId) {
        requireManagedDanceList(danceListId, userId);
        guestCodeJooqRepository.deleteByDanceListId(danceListId);
    }

    private void requireManagedPlaylist(UUID playlistId, UUID userId) {
        Playlist playlist = playlistJooqRepository.findById(playlistId)
            .orElseThrow(() -> new ResourceNotFoundException("The playlist does not exist."));
        if (!collaborationAccess.hasFullControl(playlist.getUserId(), playlist.getGroupId(), userId)) {
            throw new ForbiddenException("You do not have permission to manage the guest code of this playlist.");
        }
    }

    private void requireManagedDanceList(UUID danceListId, UUID userId) {
        DanceList danceList = danceListJooqRepository.findById(danceListId)
            .orElseThrow(() -> new ResourceNotFoundException("The dance list does not exist."));
        if (!collaborationAccess.hasFullControl(danceList.getUserId(), danceList.getGroupId(), userId)) {
            throw new ForbiddenException("You do not have permission to manage the guest code of this dance list.");
        }
    }

    private String newCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder code = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            }
            if (!guestCodeJooqRepository.existsByCode(code.toString())) {
                return code.toString();
            }
        }
        throw new IllegalStateException("Could not find a free guest code.");
    }

    // ===== Using the code =====

    @Transactional(readOnly = true)
    public GuestListDto findList(String rawCode) {
        return toGuestListDto(requireCode(rawCode));
    }

    @Transactional
    public GuestListDto addTrack(String rawCode, UUID trackId) {
        GuestCode guestCode = requireCode(rawCode);
        if (guestCode.playlistId() == null) {
            throw new BadRequestException("This code belongs to a dance list. Add a dance to it.");
        }
        if (trackId == null) {
            throw new BadRequestException("Give the track to add.");
        }
        UUID playlistId = guestCode.playlistId();
        trackJooqRepository.findById(trackId)
            .orElseThrow(() -> new ResourceNotFoundException("Track", trackId));
        privateTrackGuard.requireVisible(trackId, null);
        if (playlistTrackJooqRepository.existsByPlaylistIdAndTrackId(playlistId, trackId)) {
            throw new ConflictException("This track is already in the playlist.");
        }
        int nextPosition = playlistJooqRepository.getTrackCount(playlistId);
        if (nextPosition >= MAX_PLAYLIST_TRACKS) {
            throw new ConflictException("The playlist is full.");
        }
        playlistTrackJooqRepository.insert(PlaylistTrack.builder()
            .playlistId(playlistId)
            .trackId(trackId)
            .position(nextPosition)
            .addedByGuest(true)
            .build());
        return toGuestListDto(guestCode);
    }

    @Transactional
    public GuestListDto addDance(String rawCode, UUID danceId, String name) {
        GuestCode guestCode = requireCode(rawCode);
        if (guestCode.danceListId() == null) {
            throw new BadRequestException("This code belongs to a playlist. Add a track to it.");
        }
        UUID danceListId = guestCode.danceListId();
        String trimmed = name == null ? "" : name.trim();
        if (danceId == null && trimmed.isEmpty()) {
            throw new BadRequestException("Give a dance from the site, or a name for the dance.");
        }
        if (trimmed.length() > MAX_ENTRY_NAME_LENGTH) {
            throw new BadRequestException("The name can be at most " + MAX_ENTRY_NAME_LENGTH + " characters.");
        }
        if (danceId != null) {
            danceJooqRepository.findById(danceId)
                .orElseThrow(() -> new ResourceNotFoundException("The dance does not exist."));
            if (entryJooqRepository.existsByDanceListIdAndDanceId(danceListId, danceId)) {
                throw new ConflictException("This dance is already in the list.");
            }
        }
        int nextPosition = entryJooqRepository.count(danceListId);
        if (nextPosition >= MAX_DANCE_LIST_ENTRIES) {
            throw new ConflictException("The dance list is full.");
        }
        entryJooqRepository.insert(DanceListEntry.builder()
            .danceListId(danceListId)
            .danceId(danceId)
            .freeTextName(danceId == null ? trimmed : null)
            .position(nextPosition)
            .addedByGuest(true)
            .build());
        return toGuestListDto(guestCode);
    }

    /** People type the code from a screen: case, spaces and dashes do not matter. */
    static String normalize(String rawCode) {
        return rawCode == null ? "" : rawCode.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private GuestCode requireCode(String rawCode) {
        String code = normalize(rawCode);
        if (code.length() != CODE_LENGTH) {
            throw new ResourceNotFoundException(NOT_FOUND);
        }
        return guestCodeJooqRepository.findByCode(code)
            .orElseThrow(() -> new ResourceNotFoundException(NOT_FOUND));
    }

    private GuestListDto toGuestListDto(GuestCode guestCode) {
        if (guestCode.playlistId() != null) {
            Playlist playlist = playlistJooqRepository.findById(guestCode.playlistId())
                .orElseThrow(() -> new ResourceNotFoundException(NOT_FOUND));
            List<UUID> trackIds = playlistTrackJooqRepository.findByPlaylistIdOrderByPositionAsc(playlist.getId()).stream()
                .map(PlaylistTrack::getTrackId)
                .toList();
            // A private track plays only for the person who holds its file, so a guest does not see it.
            Set<UUID> hidden = privateTrackGuard.hiddenTrackIds(trackIds, null);
            Map<UUID, TrackListDto> dtoById = trackJooqRepository.findTrackListDtosByIds(trackIds).stream()
                .collect(Collectors.toMap(TrackListDto::getId, dto -> dto));
            List<TrackListDto> tracks = trackIds.stream()
                .filter(id -> !hidden.contains(id))
                .map(dtoById::get)
                .filter(Objects::nonNull)
                .toList();
            return GuestListDto.builder()
                .type("playlist")
                .name(playlist.getName())
                .description(playlist.getDescription())
                .ownerName(ownerName(playlist.getUserId(), playlist.getGroupId()))
                .tracks(tracks)
                .build();
        }
        DanceList danceList = danceListJooqRepository.findById(guestCode.danceListId())
            .orElseThrow(() -> new ResourceNotFoundException(NOT_FOUND));
        List<DanceListEntry> entries = entryJooqRepository.findByDanceListIdOrderByPosition(danceList.getId());
        Map<UUID, String> danceNamesById = danceJooqRepository.findNamesByIds(entries.stream()
            .map(DanceListEntry::getDanceId)
            .filter(Objects::nonNull)
            .distinct()
            .toList());
        List<GuestDanceDto> dances = entries.stream()
            .map(entry -> new GuestDanceDto(entry.getDanceId(),
                entry.getFreeTextName() != null ? entry.getFreeTextName() : danceNamesById.get(entry.getDanceId())))
            .toList();
        return GuestListDto.builder()
            .type("dance_list")
            .name(danceList.getName())
            .description(danceList.getDescription())
            .ownerName(ownerName(danceList.getUserId(), danceList.getGroupId()))
            .dances(dances)
            .build();
    }

    private String ownerName(UUID userId, UUID groupId) {
        if (groupId != null) {
            return groupJooqRepository.findById(groupId).map(Group::getName).orElse(null);
        }
        if (userId == null) return null;
        return userJooqRepository.findById(userId)
            .map(user -> user.getDisplayName() != null ? user.getDisplayName() : user.getUsername())
            .orElse(null);
    }
}
