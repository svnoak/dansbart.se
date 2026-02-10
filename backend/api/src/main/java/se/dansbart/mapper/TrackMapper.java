package se.dansbart.mapper;

import org.mapstruct.*;
import se.dansbart.domain.track.*;
import se.dansbart.domain.artist.TrackArtist;
import se.dansbart.domain.album.TrackAlbum;
import se.dansbart.dto.*;

import java.util.List;

/**
 * MapStruct mapper for Track entity to DTO conversions.
 */
@Mapper(componentModel = "spring", uses = {ArtistMapper.class, AlbumMapper.class})
public interface TrackMapper {

    /**
     * Convert Track entity to full TrackDto.
     */
    @Mapping(target = "danceStyle", source = "track", qualifiedByName = "primaryDanceStyle")
    @Mapping(target = "subStyle", source = "track", qualifiedByName = "primarySubStyle")
    @Mapping(target = "effectiveBpm", source = "track", qualifiedByName = "primaryEffectiveBpm")
    @Mapping(target = "tempoCategory", source = "track", qualifiedByName = "primaryTempoCategory")
    @Mapping(target = "confidence", source = "track", qualifiedByName = "primaryConfidence")
    @Mapping(target = "isUserConfirmed", source = "track", qualifiedByName = "primaryIsUserConfirmed")
    @Mapping(target = "artists", source = "artistLinks")
    @Mapping(target = "album", source = "track", qualifiedByName = "primaryAlbum")
    @Mapping(target = "allDanceStyles", source = "danceStyles")
    TrackDto toDto(Track track);

    /**
     * Convert Track entity to minimal TrackListDto.
     */
    @Mapping(target = "danceStyle", source = "track", qualifiedByName = "primaryDanceStyle")
    @Mapping(target = "subStyle", source = "track", qualifiedByName = "primarySubStyle")
    @Mapping(target = "effectiveBpm", source = "track", qualifiedByName = "primaryEffectiveBpm")
    @Mapping(target = "confidence", source = "track", qualifiedByName = "primaryConfidence")
    @Mapping(target = "artistName", source = "track", qualifiedByName = "primaryArtistName")
    @Mapping(target = "playbackPlatform", source = "track", qualifiedByName = "firstPlaybackPlatform")
    @Mapping(target = "playbackLink", source = "track", qualifiedByName = "firstPlaybackLink")
    TrackListDto toListDto(Track track);

    List<TrackDto> toDtoList(List<Track> tracks);

    List<TrackListDto> toListDtoList(List<Track> tracks);

    // Map dance style entity to DTO
    DanceStyleDto toDanceStyleDto(TrackDanceStyle danceStyle);

    List<DanceStyleDto> toDanceStyleDtoList(List<TrackDanceStyle> danceStyles);

    // Map playback link entity to DTO
    PlaybackLinkDto toPlaybackLinkDto(PlaybackLink playbackLink);

    List<PlaybackLinkDto> toPlaybackLinkDtoList(List<PlaybackLink> playbackLinks);

    // Custom mapping methods for extracting primary values
    @Named("primaryDanceStyle")
    default String getPrimaryDanceStyle(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getDanceStyle)
                .orElse(null);
    }

    @Named("primarySubStyle")
    default String getPrimarySubStyle(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getSubStyle)
                .orElse(null);
    }

    @Named("primaryEffectiveBpm")
    default Integer getPrimaryEffectiveBpm(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getEffectiveBpm)
                .orElse(null);
    }

    @Named("primaryTempoCategory")
    default String getPrimaryTempoCategory(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getTempoCategory)
                .orElse(null);
    }

    @Named("primaryConfidence")
    default Float getPrimaryConfidence(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getConfidence)
                .orElse(null);
    }

    @Named("primaryIsUserConfirmed")
    default Boolean getPrimaryIsUserConfirmed(Track track) {
        return track.getDanceStyles().stream()
                .filter(ds -> Boolean.TRUE.equals(ds.getIsPrimary()))
                .findFirst()
                .map(TrackDanceStyle::getIsUserConfirmed)
                .orElse(null);
    }

    @Named("primaryArtistName")
    default String getPrimaryArtistName(Track track) {
        return track.getArtistLinks().stream()
                .filter(al -> "primary".equals(al.getRole()))
                .findFirst()
                .map(al -> al.getArtist().getName())
                .orElse(track.getArtistLinks().isEmpty() ? null :
                        track.getArtistLinks().get(0).getArtist().getName());
    }

    @Named("primaryAlbum")
    default AlbumSummaryDto getPrimaryAlbum(Track track) {
        if (track.getAlbumLinks().isEmpty()) {
            return null;
        }
        var album = track.getAlbumLinks().get(0).getAlbum();
        return AlbumSummaryDto.builder()
                .id(album.getId())
                .title(album.getTitle())
                .coverImageUrl(album.getCoverImageUrl())
                .releaseDate(album.getReleaseDate())
                .build();
    }

    @Named("firstPlaybackPlatform")
    default String getFirstPlaybackPlatform(Track track) {
        return track.getPlaybackLinks().stream()
                .filter(pl -> Boolean.TRUE.equals(pl.getIsWorking()))
                .findFirst()
                .map(PlaybackLink::getPlatform)
                .orElse(null);
    }

    @Named("firstPlaybackLink")
    default String getFirstPlaybackLink(Track track) {
        return track.getPlaybackLinks().stream()
                .filter(pl -> Boolean.TRUE.equals(pl.getIsWorking()))
                .findFirst()
                .map(PlaybackLink::getDeepLink)
                .orElse(null);
    }
}
