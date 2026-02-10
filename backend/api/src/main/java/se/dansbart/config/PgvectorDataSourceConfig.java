package se.dansbart.config;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DelegatingDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

import static com.pgvector.PGvector.addVectorType;

/**
 * Ensures pgvector types are registered on every JDBC connection obtained from the pool,
 * so that Hibernate can read/write the {@code vector} column via {@link PgvectorType}.
 */
@Configuration
public class PgvectorDataSourceConfig {

    @Bean
    public static BeanPostProcessor pgvectorDataSourcePostProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
                if (bean instanceof DataSource && !(bean instanceof PgvectorRegisteringDataSource)) {
                    return new PgvectorRegisteringDataSource((DataSource) bean);
                }
                return bean;
            }
        };
    }

    private static class PgvectorRegisteringDataSource extends DelegatingDataSource {

        PgvectorRegisteringDataSource(DataSource targetDataSource) {
            super(targetDataSource);
        }

        @Override
        public Connection getConnection() throws SQLException {
            Connection conn = getTargetDataSource().getConnection();
            addVectorType(conn);
            return conn;
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            Connection conn = getTargetDataSource().getConnection(username, password);
            addVectorType(conn);
            return conn;
        }
    }
}
