package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_STYLE_CONFIG;

@Repository
public class DanceStyleConfigJooqRepository {

    private final DSLContext dsl;

    public DanceStyleConfigJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<DanceStyleConfig> findByIsActiveTrue() {
        return dsl.selectFrom(DANCE_STYLE_CONFIG)
            .where(DANCE_STYLE_CONFIG.IS_ACTIVE.eq(true))
            .orderBy(DANCE_STYLE_CONFIG.MAIN_STYLE.asc())
            .fetch(this::toConfig);
    }

    public Optional<DanceStyleConfig> findById(UUID id) {
        return dsl.selectFrom(DANCE_STYLE_CONFIG)
            .where(DANCE_STYLE_CONFIG.ID.eq(id))
            .fetchOptional(this::toConfig);
    }

    public Optional<DanceStyleConfig> findByMainStyleAndSubStyle(String mainStyle, String subStyle) {
        var condition = DANCE_STYLE_CONFIG.MAIN_STYLE.eq(mainStyle);
        if (subStyle != null) {
            condition = condition.and(DANCE_STYLE_CONFIG.SUB_STYLE.eq(subStyle));
        } else {
            condition = condition.and(DANCE_STYLE_CONFIG.SUB_STYLE.isNull());
        }
        return dsl.selectFrom(DANCE_STYLE_CONFIG)
            .where(condition)
            .fetchOptional(this::toConfig);
    }

    public boolean existsByMainStyleAndSubStyle(String mainStyle, String subStyle) {
        var condition = DANCE_STYLE_CONFIG.MAIN_STYLE.eq(mainStyle);
        if (subStyle != null) {
            condition = condition.and(DANCE_STYLE_CONFIG.SUB_STYLE.eq(subStyle));
        } else {
            condition = condition.and(DANCE_STYLE_CONFIG.SUB_STYLE.isNull());
        }
        return dsl.fetchExists(
            dsl.selectOne().from(DANCE_STYLE_CONFIG).where(condition)
        );
    }

    public Page<DanceStyleConfig> findAllPaginated(Pageable pageable) {
        long total = dsl.fetchCount(DANCE_STYLE_CONFIG);
        List<DanceStyleConfig> content = dsl.selectFrom(DANCE_STYLE_CONFIG)
            .orderBy(DANCE_STYLE_CONFIG.MAIN_STYLE.asc(), DANCE_STYLE_CONFIG.SUB_STYLE.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toConfig);
        return new PageImpl<>(content, pageable, total);
    }

    public Page<DanceStyleConfig> findByMainStylePaginated(String mainStyle, Pageable pageable) {
        var condition = DANCE_STYLE_CONFIG.MAIN_STYLE.eq(mainStyle);
        long total = dsl.fetchCount(dsl.selectFrom(DANCE_STYLE_CONFIG).where(condition));
        List<DanceStyleConfig> content = dsl.selectFrom(DANCE_STYLE_CONFIG)
            .where(condition)
            .orderBy(DANCE_STYLE_CONFIG.SUB_STYLE.asc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toConfig);
        return new PageImpl<>(content, pageable, total);
    }

    public DanceStyleConfig save(DanceStyleConfig config) {
        if (config.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(DANCE_STYLE_CONFIG)
                .columns(
                    DANCE_STYLE_CONFIG.ID,
                    DANCE_STYLE_CONFIG.MAIN_STYLE,
                    DANCE_STYLE_CONFIG.SUB_STYLE,
                    DANCE_STYLE_CONFIG.BEATS_PER_BAR,
                    DANCE_STYLE_CONFIG.IS_ACTIVE,
                    DANCE_STYLE_CONFIG.UPDATED_AT
                )
                .values(
                    id,
                    config.getMainStyle(),
                    config.getSubStyle(),
                    config.getBeatsPerBar(),
                    config.getIsActive(),
                    config.getUpdatedAt()
                )
                .execute();
            config.setId(id);
        } else {
            dsl.update(DANCE_STYLE_CONFIG)
                .set(DANCE_STYLE_CONFIG.MAIN_STYLE, config.getMainStyle())
                .set(DANCE_STYLE_CONFIG.SUB_STYLE, config.getSubStyle())
                .set(DANCE_STYLE_CONFIG.BEATS_PER_BAR, config.getBeatsPerBar())
                .set(DANCE_STYLE_CONFIG.IS_ACTIVE, config.getIsActive())
                .set(DANCE_STYLE_CONFIG.UPDATED_AT, config.getUpdatedAt())
                .where(DANCE_STYLE_CONFIG.ID.eq(config.getId()))
                .execute();
        }
        return config;
    }

    public void deleteById(UUID id) {
        dsl.deleteFrom(DANCE_STYLE_CONFIG)
            .where(DANCE_STYLE_CONFIG.ID.eq(id))
            .execute();
    }

    public boolean existsById(UUID id) {
        return dsl.fetchExists(
            dsl.selectOne().from(DANCE_STYLE_CONFIG).where(DANCE_STYLE_CONFIG.ID.eq(id))
        );
    }

    private DanceStyleConfig toConfig(Record r) {
        DanceStyleConfig c = new DanceStyleConfig();
        c.setId(r.get(DANCE_STYLE_CONFIG.ID));
        c.setMainStyle(r.get(DANCE_STYLE_CONFIG.MAIN_STYLE));
        c.setSubStyle(r.get(DANCE_STYLE_CONFIG.SUB_STYLE));
        c.setBeatsPerBar(r.get(DANCE_STYLE_CONFIG.BEATS_PER_BAR));
        c.setIsActive(r.get(DANCE_STYLE_CONFIG.IS_ACTIVE));
        c.setCreatedAt(r.get(DANCE_STYLE_CONFIG.CREATED_AT));
        c.setUpdatedAt(r.get(DANCE_STYLE_CONFIG.UPDATED_AT));
        return c;
    }
}