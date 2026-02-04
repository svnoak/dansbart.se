package se.dansbart.domain.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StyleKeywordRepository extends JpaRepository<StyleKeyword, UUID> {

    List<StyleKeyword> findByIsActiveTrue();

    @Query("SELECT DISTINCT sk.mainStyle FROM StyleKeyword sk WHERE sk.isActive = true ORDER BY sk.mainStyle")
    List<String> findDistinctMainStyles();

    @Query("SELECT DISTINCT sk.subStyle FROM StyleKeyword sk WHERE sk.mainStyle = :mainStyle AND sk.subStyle IS NOT NULL AND sk.isActive = true ORDER BY sk.subStyle")
    List<String> findSubStylesByMainStyle(String mainStyle);

    Optional<StyleKeyword> findByKeywordIgnoreCase(String keyword);

    boolean existsByKeywordIgnoreCase(String keyword);

    Page<StyleKeyword> findAllByOrderByKeywordAsc(Pageable pageable);

    Page<StyleKeyword> findByMainStyleOrderByKeywordAsc(String mainStyle, Pageable pageable);

    Page<StyleKeyword> findByIsActiveOrderByKeywordAsc(Boolean isActive, Pageable pageable);

    @Query("SELECT sk FROM StyleKeyword sk WHERE " +
           "LOWER(sk.keyword) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY sk.keyword ASC")
    Page<StyleKeyword> searchByKeyword(@Param("search") String search, Pageable pageable);

    @Query("SELECT sk.mainStyle, COUNT(sk) FROM StyleKeyword sk WHERE sk.isActive = true GROUP BY sk.mainStyle")
    List<Object[]> countByMainStyle();

    long countByIsActive(Boolean isActive);
}
