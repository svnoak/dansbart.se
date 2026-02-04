package se.dansbart.mapper;

import org.mapstruct.*;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.dto.UserDto;
import se.dansbart.dto.UserSummaryDto;
import se.dansbart.dto.PlaylistSummaryDto;

import java.util.List;
import java.util.stream.Collectors;

/**
 * MapStruct mapper for User entity to DTO conversions.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    /**
     * Convert User entity to full UserDto.
     */
    @Mapping(target = "playlists", source = "playlists", qualifiedByName = "toPlaylistSummaryList")
    @Mapping(target = "collaborations", source = "collaborations", qualifiedByName = "toCollaborationSummaryList")
    UserDto toDto(User user);

    /**
     * Convert User entity to minimal UserSummaryDto.
     */
    UserSummaryDto toSummaryDto(User user);

    List<UserDto> toDtoList(List<User> users);

    List<UserSummaryDto> toSummaryDtoList(List<User> users);

    @Named("toPlaylistSummaryList")
    default List<PlaylistSummaryDto> toPlaylistSummaryList(
            List<se.dansbart.domain.playlist.Playlist> playlists
    ) {
        if (playlists == null) {
            return null;
        }
        return playlists.stream()
                .map(p -> PlaylistSummaryDto.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .description(p.getDescription())
                        .isPublic(p.getIsPublic())
                        .trackCount(p.getTracks() != null ? p.getTracks().size() : 0)
                        .ownerDisplayName(p.getUser() != null ? p.getUser().getDisplayName() : null)
                        .build())
                .collect(Collectors.toList());
    }

    @Named("toCollaborationSummaryList")
    default List<PlaylistSummaryDto> toCollaborationSummaryList(
            List<PlaylistCollaborator> collaborations
    ) {
        if (collaborations == null) {
            return null;
        }
        return collaborations.stream()
                .map(c -> {
                    var p = c.getPlaylist();
                    return PlaylistSummaryDto.builder()
                            .id(p.getId())
                            .name(p.getName())
                            .description(p.getDescription())
                            .isPublic(p.getIsPublic())
                            .trackCount(p.getTracks() != null ? p.getTracks().size() : 0)
                            .ownerDisplayName(p.getUser() != null ? p.getUser().getDisplayName() : null)
                            .build();
                })
                .collect(Collectors.toList());
    }
}
