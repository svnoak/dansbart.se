-- Aggregate path navigation counter. No session linkage — purely additive.
CREATE TABLE path_counts (
    path  VARCHAR(500) NOT NULL,
    date  DATE         NOT NULL DEFAULT CURRENT_DATE,
    count BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (path, date)
);

CREATE INDEX path_counts_date_idx ON path_counts (date);
