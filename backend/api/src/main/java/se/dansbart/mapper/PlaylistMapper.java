package se.dansbart.mapper;

import org.mapstruct.*;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistTrack;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.dto.*;

import java.util.List;

/**
 * MapStruct mapper for Playlist entity to DTO conversions.
 */
@Mapper(componentModel = "spring", uses = {TrackMapper.class, UserMapper.class})
public interface PlaylistMapper {

    /**
     * Convert Playlist entity to full PlaylistDto.
     */
    @Mapping(target = "owner", source = "user")
    @Mapping(target = "trackCount", expression = "java(playlist.getTracks() != null ? playlist.getTracks().size() : 0)")
    @Mapping(target = "tracks", source = "tracks")
    @Mapping(target = "collaborators", source = "collaborators", qualifiedByName = "toCollaboratorSummaryList")
    PlaylistDto toDto(Playlist playlist);

    /**
     * Convert Playlist entity to minimal PlaylistSummaryDto.
     */
    @Mapping(target = "trackCount", expression = "java(playlist.getTracks() != null ? playlist.getTracks().size() : 0)")
    @Mapping(target = "ownerDisplayName", source = "user.displayName")
    PlaylistSummaryDto toSummaryDto(Playlist playlist);

    /**
     * Convert PlaylistTrack to PlaylistTrackDto.
     */
    @Mapping(target = "track", source = "track")
    PlaylistTrackDto toPlaylistTrackDto(PlaylistTrack playlistTrack);

    List<PlaylistDto> toDtoList(List<Playlist> playlists);

    List<PlaylistSummaryDto> toSummaryDtoList(List<Playlist> playlists);

    List<PlaylistTrackDto> toPlaylistTrackDtoList(List<PlaylistTrack> playlistTracks);

    @Named("toCollaboratorSummaryList")
    default List<UserSummaryDto> toCollaboratorSummaryList(List<PlaylistCollaborator> collaborators) {
        if (collaborators == null) {
            return null;
        }
        return collaborators.stream()
                .map(c -> UserSummaryDto.builder()
                        .id(c.getUser().getId())
                        .username(c.getUser().getUsername())
                        .displayName(c.getUser().getDisplayName())
                        .avatarUrl(c.getUser().getAvatarUrl())
                        .build())
                .toList();
    }
}
