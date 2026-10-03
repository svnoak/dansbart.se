package se.dansbart.domain.library;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.domain.track.UserTrackSourceJooqRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class LibraryService {

    private final TrackJooqRepository trackRepository;
    private final UserTrackSourceJooqRepository sourceRepository;

    public LibraryImportResponse importTrack(UUID userId, ImportTrackRequest request) {
        UUID trackId;
        boolean linkedToCatalog = false;

        Optional<UUID> existingByHash = trackRepository.findTrackByContentHash(request.contentHash());
        if (existingByHash.isPresent()) {
            trackId = existingByHash.get();
            Optional<UUID> existingSourceId = sourceRepository.findSourceId(userId, trackId, request.provider());
            if (existingSourceId.isPresent()) {
                return new LibraryImportResponse(existingSourceId.get(), trackId, linkedToCatalog, true);
            }
        } else if (request.isrc() != null) {
            Optional<UUID> catalogTrackId = trackRepository.findPublicTrackByIsrc(request.isrc());
            if (catalogTrackId.isPresent()) {
                UUID candidateId = catalogTrackId.get();
                Optional<Integer> catalogDuration = trackRepository.getTrackDuration(candidateId);
                if (catalogDuration.isPresent() && request.durationMs() != null) {
                    int diff = Math.abs(catalogDuration.get() - request.durationMs());
                    if (diff <= 3000) {
                        trackId = candidateId;
                        linkedToCatalog = true;
                        trackRepository.updateTrackContentHash(trackId, request.contentHash());
                    } else {
                        trackId = createPrivateTrack(request);
                    }
                } else {
                    trackId = createPrivateTrack(request);
                }
            } else {
                trackId = createPrivateTrack(request);
            }
        } else {
            trackId = createPrivateTrack(request);
        }

        UUID sourceId = sourceRepository.upsertSource(userId, trackId, request.provider(),
            request.providerFileId(), request.title(), request.artist(), request.album());
        return new LibraryImportResponse(sourceId, trackId, linkedToCatalog, false);
    }

    public List<LibrarySourceDto> listUserSources(UUID userId) {
        return sourceRepository.findUserSourcesNewestFirst(userId).stream()
            .map(source -> new LibrarySourceDto(source.id(), source.trackId(), source.title(), source.artist(),
                source.album(), source.provider(), source.addedAt(), !source.trackIsPrivate()))
            .toList();
    }

    public boolean deleteSource(UUID sourceId, UUID userId) {
        return sourceRepository.deleteSourceIfOwner(sourceId, userId);
    }

    public Optional<Boolean> matchesHash(UUID sourceId, UUID userId, String contentHash) {
        return sourceRepository.trackHasHash(sourceId, userId, contentHash);
    }

    private UUID createPrivateTrack(ImportTrackRequest request) {
        Track track = new Track();
        track.setId(UUID.randomUUID());
        track.setTitle(request.title());
        track.setIsPrivate(true);
        track.setContentHash(request.contentHash());
        track.setDurationMs(request.durationMs());
        trackRepository.insert(track);
        return track.getId();
    }
}
