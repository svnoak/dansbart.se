package se.dansbart.domain.album;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.track.TrackService;
import se.dansbart.dto.AlbumDto;
import se.dansbart.dto.ArtistSummaryDto;
import se.dansbart.dto.TrackListDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AlbumService {

    private final AlbumJooqRepository albumJooqRepository;
    private final ArtistJooqRepository artistJooqRepository;
    private final TrackService trackService;

    public Optional<Album> findById(UUID id) {
        return albumJooqRepository.findById(id);
    }

    /** Album detail with tracks as TrackListDto (danceStyle, subStyle, playback, artist). */
    public Optional<AlbumDto> findByIdAsDto(UUID id) {
        return albumJooqRepository.findById(id)
            .map(album -> {
                ArtistSummaryDto artistSummary = album.getArtistId() != null
                    ? artistJooqRepository.findById(album.getArtistId())
                        .map(a -> ArtistSummaryDto.builder()
                            .id(a.getId())
                            .name(a.getName())
                            .imageUrl(a.getImageUrl())
                            .build())
                        .orElse(null)
                    : null;
                List<TrackListDto> tracks = trackService.findByAlbumIdAsListDtos(id);
                return AlbumDto.builder()
                    .id(album.getId())
                    .title(album.getTitle())
                    .coverImageUrl(album.getCoverImageUrl())
                    .releaseDate(album.getReleaseDate())
                    .spotifyId(album.getSpotifyId())
                    .artist(artistSummary)
                    .trackCount(tracks.size())
                    .tracks(tracks)
                    .build();
            });
    }

    public Page<Album> findAll(Pageable pageable) {
        return albumJooqRepository.findAll(pageable);
    }

    public Page<Album> findAllRandom(Pageable pageable) {
        return albumJooqRepository.findAllRandom(pageable);
    }

    public List<Album> findByArtistId(UUID artistId) {
        return albumJooqRepository.findByArtistId(artistId);
    }

    public Page<Album> searchByTitle(String query, Pageable pageable) {
        return albumJooqRepository.searchByTitle(query, pageable);
    }
}
