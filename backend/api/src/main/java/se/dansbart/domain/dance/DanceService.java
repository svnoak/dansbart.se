package se.dansbart.domain.dance;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.TrackFeedbackService;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.DanceDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.request.DanceImportItem;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DanceService {

    private final DanceJooqRepository danceJooqRepository;
    private final TrackJooqRepository trackJooqRepository;
    private final DanceTrackVoteRepository voteRepository;
    private final TrackFeedbackService trackFeedbackService;

    public Page<DanceDto> getDances(String search, String danceType, Pageable pageable) {
        Page<Dance> page = danceJooqRepository.findAll(search, danceType, pageable);
        List<UUID> ids = page.getContent().stream().map(Dance::getId).toList();
        Map<UUID, Integer> counts = danceJooqRepository.countConfirmedByDanceIds(ids);
        List<DanceDto> dtos = page.getContent().stream()
                .map(d -> toDto(d, counts.getOrDefault(d.getId(), 0)))
                .toList();
        return new PageImpl<>(dtos, pageable, page.getTotalElements());
    }

    public Optional<DanceDto> getDanceById(UUID id) {
        return danceJooqRepository.findById(id)
                .map(d -> toDto(d, danceJooqRepository.countConfirmedTracksByDanceId(d.getId())));
    }

    public List<TrackListDto> getConfirmedTracksForDance(UUID danceId) {
        List<DanceTrack> links = danceJooqRepository.findConfirmedTracksByDanceId(danceId);
        if (links.isEmpty()) return List.of();
        List<UUID> trackIds = links.stream().map(DanceTrack::getTrackId).toList();
        return trackJooqRepository.findTrackListDtosByIds(trackIds);
    }

    @Transactional
    public DanceTrack suggestTrack(UUID danceId, UUID trackId, UUID userId) {
        return danceJooqRepository.addTrack(danceId, trackId, userId);
    }

    @Transactional
    public void confirmTrack(UUID danceTrackId, UUID adminId) {
        danceJooqRepository.confirmTrack(danceTrackId, adminId);
    }

    @Transactional
    public void removeTrack(UUID danceId, UUID trackId) {
        danceJooqRepository.removeTrack(danceId, trackId);
    }

    public Page<DanceTrack> getPendingLinks(Pageable pageable) {
        List<DanceTrack> items = danceJooqRepository.findPendingLinks(pageable);
        long total = danceJooqRepository.countPendingLinks();
        return new PageImpl<>(items, pageable, total);
    }

    @Transactional
    public Optional<DanceDto> updateDance(UUID id, DanceImportItem item) {
        String name = item.getName() == null ? "" : item.getName().strip();
        boolean updated = danceJooqRepository.update(
                id, name, slugify(name),
                item.getDanceDescriptionUrl(), item.getDanceType(), item.getMusic());
        if (!updated) return Optional.empty();
        return danceJooqRepository.findById(id)
                .map(d -> toDto(d, danceJooqRepository.countConfirmedTracksByDanceId(d.getId())));
    }

    @Transactional
    public boolean deleteDance(UUID id) {
        return danceJooqRepository.delete(id);
    }

    @Transactional
    public Map<String, Integer> importDances(List<DanceImportItem> items) {
        List<Dance> dances = items.stream()
                .filter(item -> item.getName() != null && !item.getName().isBlank())
                .map(item -> Dance.builder()
                        .name(item.getName().strip())
                        .slug(slugify(item.getName()))
                        .danceDescriptionUrl(item.getDanceDescriptionUrl())
                        .danceType(item.getDanceType())
                        .music(item.getMusic())
                        .build())
                .toList();
        int imported = danceJooqRepository.upsertDances(dances);

        int linked = 0;
        for (Dance dance : dances) {
            if (dance.getMusic() == null || dance.getMusic().isBlank()) continue;
            String fragment = stripArtistSuffix(dance.getMusic());
            if (fragment.length() < 3) continue;
            Optional<Dance> saved = danceJooqRepository.findBySlug(dance.getSlug());
            if (saved.isEmpty()) continue;
            List<UUID> trackIds = danceJooqRepository.findTrackIdsByTitleFragment(fragment);
            for (UUID trackId : trackIds) {
                danceJooqRepository.addTrackConfirmed(saved.get().getId(), trackId, null);
                linked++;
            }
        }
        return Map.of("imported", imported, "linked", linked);
    }

    @Transactional
    public void addTrackConfirmed(UUID danceId, UUID trackId, UUID adminId) {
        danceJooqRepository.addTrackConfirmed(danceId, trackId, adminId);
    }

    public Page<TrackListDto> getRecommendations(UUID danceId, int limit, int offset) {
        Optional<Dance> danceOpt = danceJooqRepository.findById(danceId);
        if (danceOpt.isEmpty()) return Page.empty();
        Dance dance = danceOpt.get();
        if (dance.getDanceType() == null || dance.getDanceType().isBlank()) return Page.empty();

        String danceType = dance.getDanceType();
        String danceName = dance.getName() != null ? dance.getName().toLowerCase() : "";
        String music = dance.getMusic() != null ? extractMusicFragment(dance.getMusic()).toLowerCase() : null;

        // Exclude upvoted tracks (shown in Passande musik) and downvote-suppressed tracks
        List<UUID> excluded = new ArrayList<>();
        excluded.addAll(voteRepository.findPassandeTrackIds(danceId));
        excluded.addAll(voteRepository.findSuppressedTrackIds(danceId));

        List<UUID> ids = danceJooqRepository.findRecommendedTrackIds(danceId, danceType, danceName, music, limit, offset, excluded);
        long total = danceJooqRepository.countRecommendedTracks(danceId, danceType, danceName, music, excluded);
        List<TrackListDto> dtos = trackJooqRepository.findTrackListDtosByIds(ids);

        int pageNum = limit > 0 ? offset / limit : 0;
        Pageable pageable = PageRequest.of(pageNum, limit > 0 ? limit : 5);
        return new PageImpl<>(dtos, pageable, total);
    }

    public List<TrackListDto> getPassandeTracks(UUID danceId) {
        Set<UUID> confirmedIds = danceJooqRepository.findConfirmedTracksByDanceId(danceId)
                .stream().map(DanceTrack::getTrackId).collect(Collectors.toSet());
        List<UUID> passandeIds = voteRepository.findPassandeTrackIds(danceId)
                .stream().filter(id -> !confirmedIds.contains(id)).toList();
        return trackJooqRepository.findTrackListDtosByIds(passandeIds);
    }

    @Transactional
    public void voteOnTrack(UUID danceId, UUID trackId, String voterId, int vote) {
        voteRepository.upsertVote(danceId, trackId, voterId, vote);
        if (vote == 1) {
            danceJooqRepository.addTrackConfirmed(danceId, trackId, null);
            danceJooqRepository.findById(danceId).ifPresent(dance -> {
                if (dance.getDanceType() != null && !dance.getDanceType().isBlank()) {
                    trackFeedbackService.submitStyleFeedback(trackId, voterId, dance.getDanceType(), null);
                }
            });
        }
    }

    @Transactional
    public void removeVote(UUID danceId, UUID trackId, String voterId) {
        voteRepository.deleteVote(danceId, trackId, voterId);
    }

    public Page<DanceDto> getDancesWithInvalidStyle(Pageable pageable) {
        List<Dance> items = danceJooqRepository.findDancesWithInvalidStyle(pageable);
        long total = danceJooqRepository.countDancesWithInvalidStyle();
        List<DanceDto> dtos = items.stream()
                .map(d -> toDto(d, danceJooqRepository.countConfirmedTracksByDanceId(d.getId())))
                .toList();
        return new PageImpl<>(dtos, pageable, total);
    }

    // Extracts the most useful tune-name fragment from the music field for recommendation matching.
    // "Lugn Hambo (Ex Horgalåten)" → "Horgalåten"  (parenthetical with "Ex" = "for example")
    // "(Horgalåten)" → "Horgalåten"
    // "Horgalåten, arr. Svensson" → "Horgalåten"  (falls back to stripArtistSuffix)
    private static String extractMusicFragment(String music) {
        if (music == null) return "";
        String stripped = music.strip();
        int parenOpen = stripped.lastIndexOf('(');
        int parenClose = stripped.lastIndexOf(')');
        if (parenOpen >= 0 && parenClose > parenOpen) {
            String inner = stripped.substring(parenOpen + 1, parenClose).strip();
            if (inner.toLowerCase().startsWith("ex ")) {
                inner = inner.substring(3).strip();
            }
            if (!inner.isBlank()) return inner;
        }
        return stripArtistSuffix(stripped);
    }

    private static String stripArtistSuffix(String music) {
        String result = music.strip();
        int commaIdx = result.indexOf(',');
        if (commaIdx > 0) result = result.substring(0, commaIdx).strip();
        int avIdx = result.toLowerCase().lastIndexOf(" av ");
        if (avIdx > 0) result = result.substring(0, avIdx).strip();
        int medIdx = result.toLowerCase().lastIndexOf(" med ");
        if (medIdx > 0) result = result.substring(0, medIdx).strip();
        return result;
    }

    private DanceDto toDto(Dance dance, long confirmedTrackCount) {
        return DanceDto.builder()
                .id(dance.getId())
                .name(dance.getName())
                .slug(dance.getSlug())
                .danceDescriptionUrl(dance.getDanceDescriptionUrl())
                .danceType(dance.getDanceType())
                .music(dance.getMusic())
                .confirmedTrackCount(confirmedTrackCount)
                .build();
    }

    /**
     * Produces a URL-safe, unique-collision-resistant slug from a dance name.
     * Swedish letters: å→a, ä→a, ö→o. Spaces and punctuation become hyphens.
     * Result is lowercase and trimmed.
     */
    static String slugify(String name) {
        if (name == null) return "";
        String normalized = Normalizer.normalize(name.strip(), Normalizer.Form.NFD);
        return normalized
                .replaceAll("\\p{M}", "")   // strip combining diacritics (å→a, ä→a, ö→o, etc.)
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }
}
