package se.dansbart.mapper;

import org.mapstruct.*;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.dto.ArtistDto;
import se.dansbart.dto.ArtistSummaryDto;
import se.dansbart.dto.AlbumSummaryDto;

import java.util.List;
import java.util.stream.Collectors;

/**
 * MapStruct mapper for Artist entity to DTO conversions.
 */
@Mapper(componentModel = "spring")
public interface ArtistMapper {

    /**
     * Convert Artist entity to full ArtistDto.
     */
    @Mapping(target = "trackCount", expression = "java(artist.getTrackLinks() != null ? artist.getTrackLinks().size() : 0)")
    @Mapping(target = "albumCount", expression = "java(artist.getAlbums() != null ? artist.getAlbums().size() : 0)")
    @Mapping(target = "albums", source = "albums", qualifiedByName = "toAlbumSummaryList")
    ArtistDto toDto(Artist artist);

    /**
     * Convert Artist entity to minimal ArtistSummaryDto.
     */
    @Mapping(target = "role", ignore = true)
    ArtistSummaryDto toSummaryDto(Artist artist);

    /**
     * Convert TrackArtist (join entity) to ArtistSummaryDto with role.
     */
    @Mapping(target = "id", source = "artist.id")
    @Mapping(target = "name", source = "artist.name")
    @Mapping(target = "imageUrl", source = "artist.imageUrl")
    @Mapping(target = "role", source = "role")
    ArtistSummaryDto toSummaryDtoFromTrackArtist(TrackArtist trackArtist);

    List<ArtistDto> toDtoList(List<Artist> artists);

    List<ArtistSummaryDto> toSummaryDtoList(List<TrackArtist> trackArtists);

    @Named("toAlbumSummaryList")
    default List<AlbumSummaryDto> toAlbumSummaryList(List<se.dansbart.domain.album.Album> albums) {
        if (albums == null) {
            return null;
        }
        return albums.stream()
                .map(album -> AlbumSummaryDto.builder()
                        .id(album.getId())
                        .title(album.getTitle())
                        .coverImageUrl(album.getCoverImageUrl())
                        .releaseDate(album.getReleaseDate())
                        .build())
                .collect(Collectors.toList());
    }
}
