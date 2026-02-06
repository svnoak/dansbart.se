package se.dansbart.config;

import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.conf.RenderNameCase;
import org.jooq.conf.RenderQuotedNames;
import org.jooq.impl.DSL;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy;

import javax.sql.DataSource;

/**
 * jOOQ configuration. Provides a type-safe DSL context backed by the application DataSource.
 * Use alongside JPA for complex queries or when you prefer explicit SQL.
 * Renders identifiers lowercase and unquoted to match PostgreSQL conventions.
 * Uses TransactionAwareDataSourceProxy so jOOQ participates in Spring transactions.
 */
@Configuration
public class JooqConfig {

    @Bean
    public DSLContext dslContext(DataSource dataSource) {
        DataSource proxy = new TransactionAwareDataSourceProxy(dataSource);
        org.jooq.conf.Settings settings = new org.jooq.conf.Settings()
            .withRenderQuotedNames(RenderQuotedNames.NEVER)
            .withRenderNameCase(RenderNameCase.LOWER);
        return DSL.using(proxy, SQLDialect.POSTGRES, settings);
    }
}
