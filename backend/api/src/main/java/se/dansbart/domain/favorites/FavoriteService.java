package se.dansbart.domain.favorites;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.TrackListDto;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteJooqRepository favoriteRepository;
    private final TrackJooqRepository trackRepository;

    public boolean toggle(UUID userId, UUID trackId) {
        if (favoriteRepository.isFavorited(userId, trackId)) {
            favoriteRepository.remove(userId, trackId);
            return false;
        }
        favoriteRepository.add(userId, trackId);
        return true;
    }

    public List<UUID> getFavoriteIds(UUID userId) {
        return favoriteRepository.findTrackIdsByUserId(userId);
    }

    public List<TrackListDto> getFavoriteTracks(UUID userId) {
        List<UUID> ids = favoriteRepository.findTrackIdsByUserId(userId);
        if (ids.isEmpty()) return List.of();
        return trackRepository.findTrackListDtosByIds(ids);
    }
}
