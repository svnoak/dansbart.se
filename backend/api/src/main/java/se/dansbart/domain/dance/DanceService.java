package se.dansbart.domain.dance;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.DanceDto;
import se.dansbart.dto.TrackListDto;
import se.dansbart.dto.request.DanceImportItem;

import java.text.Normalizer;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DanceService {

    private final DanceJooqRepository danceJooqRepository;
    private final TrackJooqRepository trackJooqRepository;

    public Page<DanceDto> getDances(String search, Pageable pageable) {
        Page<Dance> page = danceJooqRepository.findAll(search, pageable);
        List<DanceDto> dtos = page.getContent().stream()
                .map(d -> toDto(d, danceJooqRepository.countConfirmedTracksByDanceId(d.getId())))
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
                item.getDanceDescriptionUrl(), item.getDanstyp(), item.getMusik());
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
                        .danstyp(item.getDanstyp())
                        .musik(item.getMusik())
                        .build())
                .toList();
        int imported = danceJooqRepository.upsertDances(dances);

        int linked = 0;
        for (Dance dance : dances) {
            if (dance.getMusik() == null || dance.getMusik().isBlank()) continue;
            String fragment = stripArtistSuffix(dance.getMusik());
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

    public Page<DanceDto> getDancesWithInvalidStyle(Pageable pageable) {
        List<Dance> items = danceJooqRepository.findDancesWithInvalidStyle(pageable);
        long total = danceJooqRepository.countDancesWithInvalidStyle();
        List<DanceDto> dtos = items.stream()
                .map(d -> toDto(d, danceJooqRepository.countConfirmedTracksByDanceId(d.getId())))
                .toList();
        return new PageImpl<>(dtos, pageable, total);
    }

    private static String stripArtistSuffix(String musik) {
        String result = musik.strip();
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
                .danstyp(dance.getDanstyp())
                .musik(dance.getMusik())
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
