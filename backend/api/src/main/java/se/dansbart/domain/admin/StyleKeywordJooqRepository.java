package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import se.dansbart.dto.AdminStyleContributionDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.lower;
import static se.dansbart.jooq.Tables.STYLE_KEYWORDS;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class StyleKeywordJooqRepository {

    private final DSLContext dsl;

    public StyleKeywordJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<StyleKeyword> findByIsActiveTrue() {
        return dsl.selectFrom(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true))
            .orderBy(STYLE_KEYWORDS.MAIN_STYLE.asc(), STYLE_KEYWORDS.KEYWORD.asc())
            .fetch(this::toKeyword);
    }

    public List<String> findDistinctMainStyles() {
        return dsl.selectDistinct(STYLE_KEYWORDS.MAIN_STYLE)
            .from(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true))
            .orderBy(STYLE_KEYWORDS.MAIN_STYLE.asc())
            .fetch(STYLE_KEYWORDS.MAIN_STYLE);
    }

    public List<String> findSubStylesByMainStyle(String mainStyle) {
        return dsl.selectDistinct(STYLE_KEYWORDS.SUB_STYLE)
            .from(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.MAIN_STYLE.eq(mainStyle)
                .and(STYLE_KEYWORDS.SUB_STYLE.isNotNull())
                .and(STYLE_KEYWORDS.IS_ACTIVE.eq(true)))
            .orderBy(STYLE_KEYWORDS.SUB_STYLE.asc())
            .fetch(STYLE_KEYWORDS.SUB_STYLE);
    }

    public Optional<StyleKeyword> findByKeywordIgnoreCase(String keyword) {
        return dsl.selectFrom(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.KEYWORD.equalIgnoreCase(keyword))
            .fetchOptional(this::toKeyword);
    }

    public boolean existsByKeywordIgnoreCase(String keyword) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(STYLE_KEYWORDS)
                .where(STYLE_KEYWORDS.KEYWORD.equalIgnoreCase(keyword))
        );
    }

    public boolean existsByMainStyleOrSubStyle(String style) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(STYLE_KEYWORDS)
                .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true)
                    .and(STYLE_KEYWORDS.MAIN_STYLE.equalIgnoreCase(style)
                        .or(STYLE_KEYWORDS.SUB_STYLE.equalIgnoreCase(style))))
        );
    }

    public Page<StyleKeyword> findAllByOrderByKeywordAsc(Pageable pageable) {
        long total = dsl.fetchCount(STYLE_KEYWORDS);
        List<StyleKeyword> content = dsl.selectFrom(STYLE_KEYWORDS)
            .orderBy(STYLE_KEYWORDS.KEYWORD.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toKeyword);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<StyleKeyword> findByMainStyleOrderByKeywordAsc(String mainStyle, Pageable pageable) {
        var condition = STYLE_KEYWORDS.MAIN_STYLE.eq(mainStyle);
        long total = dsl.fetchCount(dsl.selectFrom(STYLE_KEYWORDS).where(condition));
        List<StyleKeyword> content = dsl.selectFrom(STYLE_KEYWORDS)
            .where(condition)
            .orderBy(STYLE_KEYWORDS.KEYWORD.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toKeyword);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<StyleKeyword> findByIsActiveOrderByKeywordAsc(Boolean isActive, Pageable pageable) {
        var condition = STYLE_KEYWORDS.IS_ACTIVE.eq(isActive);
        long total = dsl.fetchCount(dsl.selectFrom(STYLE_KEYWORDS).where(condition));
        List<StyleKeyword> content = dsl.selectFrom(STYLE_KEYWORDS)
            .where(condition)
            .orderBy(STYLE_KEYWORDS.KEYWORD.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toKeyword);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<StyleKeyword> searchByKeyword(String search, Pageable pageable) {
        var condition = lower(STYLE_KEYWORDS.KEYWORD).like("%" + search.toLowerCase() + "%");
        long total = dsl.fetchCount(dsl.selectFrom(STYLE_KEYWORDS).where(condition));
        List<StyleKeyword> content = dsl.selectFrom(STYLE_KEYWORDS)
            .where(condition)
            .orderBy(STYLE_KEYWORDS.KEYWORD.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toKeyword);
        return new PageImpl<>(content, pageable, total);
    }

    public List<Object[]> countByMainStyle() {
        return dsl.select(STYLE_KEYWORDS.MAIN_STYLE, count())
            .from(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true))
            .groupBy(STYLE_KEYWORDS.MAIN_STYLE)
            .fetch(r -> new Object[]{r.get(STYLE_KEYWORDS.MAIN_STYLE), r.get(1, Long.class)});
    }

    public long countByIsActive(Boolean isActive) {
        return dsl.fetchCount(dsl.selectFrom(STYLE_KEYWORDS).where(STYLE_KEYWORDS.IS_ACTIVE.eq(isActive)));
    }

    public Optional<StyleKeyword> findById(UUID id) {
        return dsl.selectFrom(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.ID.eq(id))
            .fetchOptional(this::toKeyword);
    }

    public boolean existsById(UUID id) {
        return dsl.fetchExists(
            dsl.selectOne().from(STYLE_KEYWORDS).where(STYLE_KEYWORDS.ID.eq(id))
        );
    }

    public StyleKeyword save(StyleKeyword keyword) {
        if (keyword.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(STYLE_KEYWORDS)
                .columns(
                    STYLE_KEYWORDS.ID,
                    STYLE_KEYWORDS.KEYWORD,
                    STYLE_KEYWORDS.MAIN_STYLE,
                    STYLE_KEYWORDS.SUB_STYLE,
                    STYLE_KEYWORDS.IS_ACTIVE,
                    STYLE_KEYWORDS.UPDATED_AT
                )
                .values(
                    id,
                    keyword.getKeyword(),
                    keyword.getMainStyle(),
                    keyword.getSubStyle(),
                    keyword.getIsActive(),
                    OffsetDateTime.now()
                )
                .execute();
            keyword.setId(id);
        } else {
            dsl.update(STYLE_KEYWORDS)
                .set(STYLE_KEYWORDS.KEYWORD, keyword.getKeyword())
                .set(STYLE_KEYWORDS.MAIN_STYLE, keyword.getMainStyle())
                .set(STYLE_KEYWORDS.SUB_STYLE, keyword.getSubStyle())
                .set(STYLE_KEYWORDS.IS_ACTIVE, keyword.getIsActive())
                .set(STYLE_KEYWORDS.UPDATED_AT, OffsetDateTime.now())
                .where(STYLE_KEYWORDS.ID.eq(keyword.getId()))
                .execute();
        }
        return keyword;
    }

    /**
     * Adds a style a user created. The style name doubles as its own keyword, so the
     * classifier also recognises it in track titles.
     */
    public UUID insertContributed(String keyword, String mainStyle, String subStyle,
                                  UUID createdBy, OffsetDateTime reviewedAt) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(STYLE_KEYWORDS)
            .set(STYLE_KEYWORDS.ID, id)
            .set(STYLE_KEYWORDS.KEYWORD, keyword)
            .set(STYLE_KEYWORDS.MAIN_STYLE, mainStyle)
            .set(STYLE_KEYWORDS.SUB_STYLE, subStyle)
            .set(STYLE_KEYWORDS.IS_ACTIVE, true)
            .set(STYLE_KEYWORDS.CREATED_BY, createdBy)
            .set(STYLE_KEYWORDS.REVIEWED_AT, reviewedAt)
            .set(STYLE_KEYWORDS.UPDATED_AT, OffsetDateTime.now())
            .execute();
        return id;
    }

    /** The main style's spelling as stored, if an active main style has this name. */
    public Optional<String> findMainStyleIgnoreCase(String name) {
        return dsl.selectDistinct(STYLE_KEYWORDS.MAIN_STYLE)
            .from(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true)
                .and(STYLE_KEYWORDS.MAIN_STYLE.equalIgnoreCase(name)))
            .limit(1)
            .fetchOptional(STYLE_KEYWORDS.MAIN_STYLE);
    }

    /** The sub-style's spelling as stored, if it is an active sub-style of mainStyle. */
    public Optional<String> findSubStyleIgnoreCase(String mainStyle, String subStyle) {
        return dsl.selectDistinct(STYLE_KEYWORDS.SUB_STYLE)
            .from(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.IS_ACTIVE.eq(true)
                .and(STYLE_KEYWORDS.MAIN_STYLE.eq(mainStyle))
                .and(STYLE_KEYWORDS.SUB_STYLE.equalIgnoreCase(subStyle)))
            .limit(1)
            .fetchOptional(STYLE_KEYWORDS.SUB_STYLE);
    }

    public long countCreatedBySince(UUID userId, OffsetDateTime since) {
        return dsl.fetchCount(STYLE_KEYWORDS,
            STYLE_KEYWORDS.CREATED_BY.eq(userId).and(STYLE_KEYWORDS.CREATED_AT.ge(since)));
    }

    private org.jooq.Condition unreviewedContribution() {
        return STYLE_KEYWORDS.CREATED_BY.isNotNull()
            .and(STYLE_KEYWORDS.REVIEWED_AT.isNull())
            .and(STYLE_KEYWORDS.IS_ACTIVE.eq(true));
    }

    public long countUnreviewedContributed() {
        return dsl.fetchCount(STYLE_KEYWORDS, unreviewedContribution());
    }

    public List<AdminStyleContributionDto> findUnreviewedContributed(int limit) {
        return dsl.select(STYLE_KEYWORDS.ID, STYLE_KEYWORDS.MAIN_STYLE, STYLE_KEYWORDS.SUB_STYLE,
                STYLE_KEYWORDS.CREATED_BY, STYLE_KEYWORDS.CREATED_AT, USERS.USERNAME, USERS.BANNED_AT)
            .from(STYLE_KEYWORDS)
            .join(USERS).on(USERS.ID.eq(STYLE_KEYWORDS.CREATED_BY))
            .where(unreviewedContribution())
            .orderBy(STYLE_KEYWORDS.CREATED_AT.desc())
            .limit(limit)
            .fetch(r -> new AdminStyleContributionDto(
                r.get(STYLE_KEYWORDS.ID),
                r.get(STYLE_KEYWORDS.MAIN_STYLE),
                r.get(STYLE_KEYWORDS.SUB_STYLE),
                r.get(STYLE_KEYWORDS.CREATED_BY),
                r.get(USERS.USERNAME),
                r.get(USERS.BANNED_AT) != null,
                r.get(STYLE_KEYWORDS.CREATED_AT)));
    }

    /** Marks a user-added style as looked at; with deactivate it also hides the style. */
    public boolean markContributionReviewed(UUID id, boolean deactivate) {
        var update = dsl.update(STYLE_KEYWORDS)
            .set(STYLE_KEYWORDS.REVIEWED_AT, OffsetDateTime.now())
            .set(STYLE_KEYWORDS.UPDATED_AT, OffsetDateTime.now());
        if (deactivate) {
            update = update.set(STYLE_KEYWORDS.IS_ACTIVE, false);
        }
        return update.where(STYLE_KEYWORDS.ID.eq(id).and(STYLE_KEYWORDS.CREATED_BY.isNotNull())).execute() > 0;
    }

    public void deleteById(UUID id) {
        dsl.deleteFrom(STYLE_KEYWORDS)
            .where(STYLE_KEYWORDS.ID.eq(id))
            .execute();
    }

    private StyleKeyword toKeyword(Record r) {
        StyleKeyword sk = new StyleKeyword();
        sk.setId(r.get(STYLE_KEYWORDS.ID));
        sk.setKeyword(r.get(STYLE_KEYWORDS.KEYWORD));
        sk.setMainStyle(r.get(STYLE_KEYWORDS.MAIN_STYLE));
        sk.setSubStyle(r.get(STYLE_KEYWORDS.SUB_STYLE));
        sk.setIsActive(r.get(STYLE_KEYWORDS.IS_ACTIVE));
        sk.setCreatedAt(r.get(STYLE_KEYWORDS.CREATED_AT));
        sk.setUpdatedAt(r.get(STYLE_KEYWORDS.UPDATED_AT));
        return sk;
    }
}

