package se.dansbart.domain.group;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.playlist.PlaylistService;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.exception.ConflictException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private GroupJooqRepository groupJooqRepository;

    @Mock
    private GroupMemberJooqRepository groupMemberJooqRepository;

    @Mock
    private UserJooqRepository userJooqRepository;

    @Mock
    private PlaylistJooqRepository playlistJooqRepository;

    @Mock
    private PlaylistService playlistService;

    private GroupService service() {
        return new GroupService(groupJooqRepository, groupMemberJooqRepository, userJooqRepository,
            playlistJooqRepository, playlistService);
    }

    @Test
    void create_concurrentNameCollision_throwsConflictException() {
        UUID creatorId = UUID.randomUUID();
        when(groupJooqRepository.findByNameIgnoreCase("Barngruppen")).thenReturn(Optional.empty());
        when(groupJooqRepository.insert(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        ConflictException exception = assertThrows(ConflictException.class,
            () -> service().create(creatorId, "Barngruppen", null, false));

        assertEquals("A group with that name already exists.", exception.getMessage());
    }

    @Test
    void update_concurrentNameCollision_throwsConflictException() {
        UUID groupId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Group group = Group.builder().id(groupId).name("Old name").isPublic(true).build();
        GroupMember membership = GroupMember.builder()
            .groupId(groupId)
            .userId(userId)
            .canEditInfo(true)
            .status("accepted")
            .build();
        lenient().when(groupJooqRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(groupMemberJooqRepository.findByGroupIdAndUserId(groupId, userId)).thenReturn(Optional.of(membership));
        when(groupJooqRepository.findByNameIgnoreCase("Barngruppen")).thenReturn(Optional.empty());
        when(groupJooqRepository.update(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        ConflictException exception = assertThrows(ConflictException.class,
            () -> service().update(groupId, userId, "Barngruppen", null, null));

        assertEquals("A group with that name already exists.", exception.getMessage());
    }
}
