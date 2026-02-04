package se.dansbart.mapper;

import org.mapstruct.*;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.dto.AlbumDto;
import se.dansbart.dto.AlbumSummaryDto;
import se.dansbart.dto.ArtistSummaryDto;

import java.util.List;

/**
 * MapStruct mapper for Album entity to DTO conversions.
 */
@Mapper(componentModel = "spring", uses = {TrackMapper.class})
public interface AlbumMapper {

    /**
     * Convert Album entity to full AlbumDto.
     */
    @Mapping(target = "artist", source = "artist", qualifiedByName = "toArtistSummary")
    @Mapping(target = "trackCount", expression = "java(album.getTrackLinks() != null ? album.getTrackLinks().size() : 0)")
    @Mapping(target = "tracks", source = "trackLinks", qualifiedByName = "toTrackListFromAlbumLinks")
    AlbumDto toDto(Album album);

    /**
     * Convert Album entity to minimal AlbumSummaryDto.
     */
    AlbumSummaryDto toSummaryDto(Album album);

    /**
     * Convert TrackAlbum (join entity) to AlbumSummaryDto.
     */
    @Mapping(target = "id", source = "album.id")
    @Mapping(target = "title", source = "album.title")
    @Mapping(target = "coverImageUrl", source = "album.coverImageUrl")
    @Mapping(target = "releaseDate", source = "album.releaseDate")
    AlbumSummaryDto toSummaryDtoFromTrackAlbum(TrackAlbum trackAlbum);

    List<AlbumDto> toDtoList(List<Album> albums);

    List<AlbumSummaryDto> toSummaryDtoList(List<Album> albums);

    @Named("toArtistSummary")
    default ArtistSummaryDto toArtistSummary(se.dansbart.domain.artist.Artist artist) {
        if (artist == null) {
            return null;
        }
        return ArtistSummaryDto.builder()
                .id(artist.getId())
                .name(artist.getName())
                .imageUrl(artist.getImageUrl())
                .build();
    }

    @Named("toTrackListFromAlbumLinks")
    default List<se.dansbart.dto.TrackListDto> toTrackListFromAlbumLinks(List<TrackAlbum> trackAlbums) {
        if (trackAlbums == null) {
            return null;
        }
        return trackAlbums.stream()
                .map(ta -> {
                    var track = ta.getTrack();
                    if (track == null) return null;
                    return se.dansbart.dto.TrackListDto.builder()
                            .id(track.getId())
                            .title(track.getTitle())
                            .durationMs(track.getDurationMs())
                            .hasVocals(track.getHasVocals())
                            .build();
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }
}
