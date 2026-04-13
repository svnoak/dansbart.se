package se.dansbart.domain.user;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.lower;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class UserJooqRepository {

    private final DSLContext dsl;

    public UserJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<User> findById(UUID id) {
        return dsl.selectFrom(USERS).where(USERS.ID.eq(id)).fetchOptional().map(this::toUser);
    }

    public Optional<User> findByDiscourseId(String discourseId) {
        return dsl.selectFrom(USERS).where(USERS.DISCOURSE_ID.eq(discourseId)).fetchOptional().map(this::toUser);
    }

    public Optional<User> findByUsername(String username) {
        return dsl.selectFrom(USERS).where(USERS.USERNAME.eq(username)).fetchOptional().map(this::toUser);
    }

    public List<User> searchByUsernameOrDisplayName(String query, Pageable pageable) {
        String pattern = "%" + (query == null ? "" : query).toLowerCase() + "%";
        return dsl.selectFrom(USERS)
            .where(lower(USERS.USERNAME).like(pattern).or(lower(USERS.DISPLAY_NAME).like(pattern)))
            .orderBy(USERS.USERNAME.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toUser);
    }

    public long countByUsernameCaseInsensitive(String username) {
        if (username == null || username.isBlank()) return 0;
        return dsl.fetchCount(dsl.selectFrom(USERS).where(lower(USERS.USERNAME).eq(username.toLowerCase())));
    }

    public long countByUsernameCaseInsensitiveExcluding(String username, UUID excludeUserId) {
        if (username == null || username.isBlank()) return 0;
        return dsl.fetchCount(
            dsl.selectFrom(USERS)
                .where(lower(USERS.USERNAME).eq(username.toLowerCase()))
                .and(USERS.ID.ne(excludeUserId))
        );
    }

    public User insert(User user) {
        UUID id = user.getId() != null ? user.getId() : UUID.randomUUID();
        dsl.insertInto(USERS)
            .columns(USERS.ID, USERS.DISCOURSE_ID, USERS.USERNAME, USERS.DISPLAY_NAME, USERS.AVATAR_URL, USERS.LAST_LOGIN_AT, USERS.ROLE)
            .values(id, user.getDiscourseId(), user.getUsername(), user.getDisplayName(), user.getAvatarUrl(), user.getLastLoginAt(), user.getRole())
            .execute();
        user.setId(id);
        return user;
    }

    public User update(User user) {
        dsl.update(USERS)
            .set(USERS.USERNAME, user.getUsername())
            .set(USERS.DISPLAY_NAME, user.getDisplayName())
            .set(USERS.AVATAR_URL, user.getAvatarUrl())
            .set(USERS.LAST_LOGIN_AT, user.getLastLoginAt())
            .where(USERS.ID.eq(user.getId()))
            .execute();
        return user;
    }

    public String findRoleById(UUID id) {
        return dsl.select(USERS.ROLE)
            .from(USERS)
            .where(USERS.ID.eq(id))
            .fetchOptional(USERS.ROLE)
            .orElse("USER");
    }

    public void updateRole(UUID id, String role) {
        dsl.update(USERS)
            .set(USERS.ROLE, role)
            .where(USERS.ID.eq(id))
            .execute();
    }

    public long countAll() {
        return dsl.fetchCount(USERS);
    }

    public List<User> findAll() {
        return dsl.selectFrom(USERS)
            .orderBy(USERS.USERNAME.asc())
            .fetch(this::toUser);
    }

    private User toUser(Record r) {
        java.time.LocalDateTime createdAtRaw = r.get(USERS.CREATED_AT);

        OffsetDateTime createdAt = createdAtRaw != null ? createdAtRaw.atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime lastLoginAt = r.get(USERS.LAST_LOGIN_AT);

        return User.builder()
            .id(r.get(USERS.ID))
            .discourseId(r.get(USERS.DISCOURSE_ID))
            .username(r.get(USERS.USERNAME))
            .displayName(r.get(USERS.DISPLAY_NAME))
            .avatarUrl(r.get(USERS.AVATAR_URL))
            .role(r.get(USERS.ROLE))
            .createdAt(createdAt)
            .lastLoginAt(lastLoginAt)
            .build();
    }
}
