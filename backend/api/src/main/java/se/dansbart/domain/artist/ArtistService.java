package se.dansbart.domain.artist;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.dto.AlbumSummaryDto;
import se.dansbart.dto.ArtistDto;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArtistService {

    private final ArtistJooqRepository artistJooqRepository;
    private final AlbumJooqRepository albumJooqRepository;

    public Optional<Artist> findById(UUID id) {
        return artistJooqRepository.findById(id);
    }

    public Optional<ArtistDto> findByIdAsDto(UUID id) {
        return artistJooqRepository.findById(id)
            .map(artist -> {
                List<AlbumSummaryDto> albumDtos = findAlbumsByArtistIdAsSummaryDtos(id);
                Map<UUID, Long> trackCounts = artistJooqRepository
                    .findTrackCountByArtistIds(List.of(id));
                long trackCount = trackCounts.getOrDefault(id, 0L);

                return ArtistDto.builder()
                    .id(artist.getId())
                    .name(artist.getName())
                    .imageUrl(artist.getImageUrl())
                    .spotifyId(artist.getSpotifyId())
                    .isVerified(artist.getIsVerified())
                    .trackCount((int) trackCount)
                    .albumCount(albumDtos.size())
                    .albums(albumDtos)
                    .build();
            });
    }

    public List<AlbumSummaryDto> findAlbumsByArtistIdAsSummaryDtos(UUID artistId) {
        List<Album> albums = albumJooqRepository.findByArtistId(artistId);
        List<UUID> albumIds = albums.stream().map(Album::getId).toList();
        Map<UUID, Long> trackCounts = albumJooqRepository.findTrackCountByAlbumIds(albumIds);

        return albums.stream()
            .map(album -> AlbumSummaryDto.builder()
                .id(album.getId())
                .title(album.getTitle())
                .coverImageUrl(album.getCoverImageUrl())
                .releaseDate(album.getReleaseDate())
                .trackCount(trackCounts.getOrDefault(album.getId(), 0L).intValue())
                .build())
            .toList();
    }

    public Page<Artist> findAll(Pageable pageable) {
        return artistJooqRepository.findAll(pageable);
    }

    public Page<Artist> findAllRandom(Pageable pageable) {
        return artistJooqRepository.findAllRandom(pageable);
    }

    public Page<Artist> searchByName(String query, Pageable pageable) {
        return artistJooqRepository.searchByName(query, pageable);
    }

    public Page<Artist> findVerifiedArtists(Pageable pageable) {
        return artistJooqRepository.findVerifiedArtists(pageable);
    }
}
