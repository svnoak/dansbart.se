package se.dansbart.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserJooqRepository userJooqRepository;

    @Transactional(readOnly = true)
    public Optional<User> findById(String id) {
        return userJooqRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByUsername(String username) {
        return userJooqRepository.findByUsername(username);
    }

    @Transactional
    public User findOrCreate(String id, String username, String displayName) {
        return userJooqRepository.findById(id)
            .map(user -> {
                user.setLastLoginAt(OffsetDateTime.now());
                return userJooqRepository.update(user);
            })
            .orElseGet(() -> {
                User newUser = User.builder()
                    .id(id)
                    .username(username)
                    .displayName(displayName)
                    .lastLoginAt(OffsetDateTime.now())
                    .build();
                return userJooqRepository.insert(newUser);
            });
    }

    @Transactional
    public Optional<User> updateProfile(String userId, String displayName, String avatarUrl) {
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
    public boolean isUsernameAvailable(String username, String excludeUserId) {
        if (excludeUserId != null) {
            return userJooqRepository.countByUsernameCaseInsensitiveExcluding(username, excludeUserId) == 0;
        }
        return userJooqRepository.countByUsernameCaseInsensitive(username) == 0;
    }
}
