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

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional
    public User findOrCreate(String id, String username, String displayName) {
        return userRepository.findById(id)
            .map(user -> {
                user.setLastLoginAt(OffsetDateTime.now());
                return userRepository.save(user);
            })
            .orElseGet(() -> {
                User newUser = User.builder()
                    .id(id)
                    .username(username)
                    .displayName(displayName)
                    .lastLoginAt(OffsetDateTime.now())
                    .build();
                return userRepository.save(newUser);
            });
    }

    @Transactional
    public Optional<User> updateProfile(String userId, String displayName, String avatarUrl) {
        return userRepository.findById(userId)
            .map(user -> {
                if (displayName != null) user.setDisplayName(displayName);
                if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
                return userRepository.save(user);
            });
    }

    @Transactional(readOnly = true)
    public List<User> searchUsers(String query, int limit) {
        return userRepository.searchByUsernameOrDisplayName(query, PageRequest.of(0, limit));
    }

    /**
     * Check if a username is available (case-insensitive).
     * Optionally excludes a specific user ID from the check.
     */
    @Transactional(readOnly = true)
    public boolean isUsernameAvailable(String username, String excludeUserId) {
        if (excludeUserId != null) {
            return userRepository.countByUsernameCaseInsensitiveExcluding(username, excludeUserId) == 0;
        }
        return userRepository.countByUsernameCaseInsensitive(username) == 0;
    }
}
