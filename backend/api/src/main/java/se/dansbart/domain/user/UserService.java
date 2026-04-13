package se.dansbart.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserJooqRepository userJooqRepository;

    @Transactional(readOnly = true)
    public Optional<User> findById(UUID id) {
        return userJooqRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByUsername(String username) {
        return userJooqRepository.findByUsername(username);
    }

    @Transactional
    public User findOrCreate(String discourseId, String username, String displayName) {
        return userJooqRepository.findByDiscourseId(discourseId)
            .map(user -> {
                // Only update username if it changed and the new name is not taken by someone else
                if (!user.getUsername().equalsIgnoreCase(username)) {
                    long conflicts = userJooqRepository.countByUsernameCaseInsensitiveExcluding(username, user.getId());
                    if (conflicts == 0) {
                        user.setUsername(username);
                    }
                }
                user.setDisplayName(displayName);
                user.setLastLoginAt(OffsetDateTime.now());
                return userJooqRepository.update(user);
            })
            .orElseGet(() -> {
                String role = userJooqRepository.countAll() == 0 ? "ADMIN" : "USER";
                User newUser = User.builder()
                    .discourseId(discourseId)
                    .username(username)
                    .displayName(displayName)
                    .role(role)
                    .lastLoginAt(OffsetDateTime.now())
                    .build();
                return userJooqRepository.insert(newUser);
            });
    }

    @Transactional
    public Optional<User> updateProfile(UUID userId, String displayName, String avatarUrl) {
        return userJooqRepository.findById(userId)
            .map(user -> {
                if (displayName != null) user.setDisplayName(displayName);
                if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
                return userJooqRepository.update(user);
            });
    }

    @Transactional(readOnly = true)
    public List<User> searchUsers(String query, int limit) {
        return userJooqRepository.searchByUsernameOrDisplayName(query, PageRequest.of(0, limit));
    }

    /**
     * Check if a username is available (case-insensitive).
     * Optionally excludes a specific user ID from the check.
     */
    @Transactional(readOnly = true)
    public boolean isUsernameAvailable(String username, UUID excludeUserId) {
        if (excludeUserId != null) {
            return userJooqRepository.countByUsernameCaseInsensitiveExcluding(username, excludeUserId) == 0;
        }
        return userJooqRepository.countByUsernameCaseInsensitive(username) == 0;
    }

    @Transactional(readOnly = true)
    public List<User> findAllUsers() {
        return userJooqRepository.findAll();
    }

    @Transactional
    public void setRole(UUID userId, String role) {
        userJooqRepository.updateRole(userId, role);
    }
}
